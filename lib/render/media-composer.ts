import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AspectRatio } from "@/lib/ai/types";

type RenderScene = {
  videoUrl: string;
  audioUrl?: string;
  duration: number;
};

type AudioSegment = {
  buffer: Buffer;
  format: string;
};

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(`找不到 ffmpeg：${ffmpegPath}`));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg 退出码：${code}`)));
  });
}

async function download(url: string, target: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!response.ok || !response.body) throw new Error(`媒体下载失败：${response.status}`);
      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(target));
      return;
    } catch (error) {
      lastError = error;
      await rm(target, { force: true }).catch(() => undefined);
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw new Error(`媒体下载重试失败：${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function renderSize(aspectRatio: AspectRatio) {
  if (aspectRatio === "16:9") return { width: 1152, height: 648 };
  if (aspectRatio === "1:1") return { width: 1024, height: 1024 };
  return { width: 768, height: 1152 };
}

function audioExtension(format: string) {
  const value = format.toLowerCase();
  if (value === "mp3" || value === "aac" || value === "m4a") return value;
  return "wav";
}

export async function combineAudioSegments(segments: AudioSegment[]) {
  if (!segments.length) throw new Error("没有可合并的旁白音频");
  if (segments.length === 1) return segments[0].buffer;

  const dir = await mkdtemp(join(tmpdir(), "anime-narration-"));
  try {
    const inputs: string[] = [];
    for (let index = 0; index < segments.length; index++) {
      const input = join(dir, `segment-${index}.${audioExtension(segments[index].format)}`);
      await writeFile(input, segments[index].buffer);
      inputs.push(input);
    }

    const output = join(dir, "narration.wav");
    const args = ["-y"];
    inputs.forEach((input) => args.push("-i", input));
    const filters = inputs.map((_, index) => `[${index}:a]aresample=48000,asetpts=PTS-STARTPTS[a${index}]`);
    filters.push(`${inputs.map((_, index) => `[a${index}]`).join("")}concat=n=${inputs.length}:v=0:a=1[outa]`);
    args.push("-filter_complex", filters.join(";"), "-map", "[outa]", "-c:a", "pcm_s16le", output);
    await runFfmpeg(args);
    return readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function composeFinalVideo(
  scenes: RenderScene[],
  options: { aspectRatio: AspectRatio; transitionDuration?: number }
) {
  if (!scenes.length) throw new Error("没有可合并的分镜");
  const transitionDuration = Math.max(0, Math.min(options.transitionDuration ?? 0.35, 1));
  const { width, height } = renderSize(options.aspectRatio);
  const dir = await mkdtemp(join(tmpdir(), "anime-final-render-"));

  try {
    const normalized: string[] = [];
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      if (!scene.videoUrl) throw new Error(`第 ${index + 1} 个分镜缺少视频 URL`);
      const duration = Math.max(1, Number(scene.duration || 5));
      const video = join(dir, `video-${index}.mp4`);
      const audio = join(dir, `audio-${index}${extname(new URL(scene.audioUrl || "file:///audio.wav").pathname) || ".wav"}`);
      const output = join(dir, `normalized-${index}.mp4`);
      await download(scene.videoUrl, video);
      if (scene.audioUrl) await download(scene.audioUrl, audio);

      const args = ["-y", "-i", video];
      if (scene.audioUrl) args.push("-i", audio);
      else args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");

      const filter = [
        `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=24,format=yuv420p,tpad=stop_mode=clone:stop_duration=${duration},trim=duration=${duration},setpts=PTS-STARTPTS[v]`,
        `[1:a]aresample=48000,apad,atrim=duration=${duration},asetpts=PTS-STARTPTS[a]`
      ].join(";");
      args.push(
        "-filter_complex", filter,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", output
      );
      await runFfmpeg(args);
      normalized.push(output);
    }

    const finalPath = join(dir, "final.mp4");
    if (normalized.length === 1) {
      await runFfmpeg(["-y", "-i", normalized[0], "-c", "copy", "-movflags", "+faststart", finalPath]);
    } else {
      const args = ["-y"];
      normalized.forEach((file) => args.push("-i", file));
      const filters: string[] = [];
      normalized.forEach((_, index) => {
        filters.push(`[${index}:v]settb=AVTB,setpts=PTS-STARTPTS[v${index}]`);
        filters.push(`[${index}:a]aresample=48000,asetpts=PTS-STARTPTS[a${index}]`);
      });

      let videoLabel = "v0";
      let audioLabel = "a0";
      let elapsed = Math.max(1, Number(scenes[0].duration || 5));
      for (let index = 1; index < normalized.length; index++) {
        const nextVideo = `vx${index}`;
        const nextAudio = `ax${index}`;
        const offset = Math.max(0, elapsed - transitionDuration);
        filters.push(`[${videoLabel}][v${index}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}[${nextVideo}]`);
        filters.push(`[${audioLabel}][a${index}]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${nextAudio}]`);
        videoLabel = nextVideo;
        audioLabel = nextAudio;
        elapsed += Math.max(1, Number(scenes[index].duration || 5)) - transitionDuration;
      }

      args.push(
        "-filter_complex", filters.join(";"),
        "-map", `[${videoLabel}]`, "-map", `[${audioLabel}]`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", finalPath
      );
      await runFfmpeg(args);
    }

    return readFile(finalPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
