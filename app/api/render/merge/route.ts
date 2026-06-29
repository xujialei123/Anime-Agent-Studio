import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

async function download(url: string, filePath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buffer);
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(process.env.FFMPEG_PATH || "ffmpeg", args);
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const videoUrls = body.videoUrls as string[];
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "缺少 videoUrls" }, { status: 400 });
    }

    const dir = await mkdtemp(join(tmpdir(), "anime-render-"));
    const files: string[] = [];

    for (let i = 0; i < videoUrls.length; i++) {
      const file = join(dir, `scene-${i}.mp4`);
      await download(videoUrls[i], file);
      files.push(file);
    }

    const listPath = join(dir, "concat.txt");
    await writeFile(listPath, files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));

    const outputPath = join(dir, "final.mp4");
    await runFfmpeg([
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      outputPath
    ]);

    const finalBuffer = await readFile(outputPath);
    const response = new NextResponse(new Blob([new Uint8Array(finalBuffer)]), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=anime-short.mp4"
      }
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
