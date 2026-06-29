import { NextRequest, NextResponse } from "next/server";
import { agnesCreateVideo } from "@/lib/providers/agnes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await agnesCreateVideo({
      prompt: String(body.prompt || ""),
      imageUrl: body.imageUrl,
      durationSeconds: Number(body.durationSeconds || 6),
      aspectRatio: body.aspectRatio || "9:16"
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
