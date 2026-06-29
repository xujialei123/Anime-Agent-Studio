import { NextRequest, NextResponse } from "next/server";
import { agnesGenerateImage } from "@/lib/providers/agnes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await agnesGenerateImage({
      prompt: String(body.prompt || ""),
      negativePrompt: body.negativePrompt,
      aspectRatio: body.aspectRatio || "9:16",
      imageUrls: body.imageUrls
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
