import { NextRequest, NextResponse } from "next/server";
import type { AspectRatio } from "@/lib/ai/types";
import { composeFinalVideo } from "@/lib/render/media-composer";

export const runtime = "nodejs";
export const maxDuration = 300;

type MergeScene = {
  videoUrl: string;
  audioUrl?: string;
  duration: number;
};

function resolveScenes(body: Record<string, unknown>) {
  if (Array.isArray(body.scenes)) return body.scenes as MergeScene[];
  if (Array.isArray(body.videoUrls)) {
    const audioUrls = Array.isArray(body.audioUrls) ? body.audioUrls : [];
    return body.videoUrls.map((videoUrl, index) => ({
      videoUrl: String(videoUrl),
      audioUrl: audioUrls[index] ? String(audioUrls[index]) : undefined,
      duration: Number(body.duration || 5)
    }));
  }
  return [];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const scenes = resolveScenes(body);
    if (!scenes.length) {
      return NextResponse.json({ error: "缺少 scenes 或 videoUrls" }, { status: 400 });
    }

    const aspectRatio = (["9:16", "16:9", "1:1"].includes(String(body.aspectRatio))
      ? String(body.aspectRatio)
      : "9:16") as AspectRatio;
    const finalBuffer = await composeFinalVideo(scenes, {
      aspectRatio,
      transitionDuration: Number(body.transitionDuration || 0.35)
    });

    return new NextResponse(new Uint8Array(finalBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=anime-short.mp4"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
