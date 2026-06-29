import { NextRequest, NextResponse } from "next/server";
import { mimoGenerateSpeech } from "@/lib/providers/mimo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await mimoGenerateSpeech({
      text: String(body.text || ""),
      styleInstruction: body.styleInstruction,
      voiceDesignPrompt: body.voiceDesignPrompt,
      useVoiceDesign: body.useVoiceDesign ?? true,
      format: body.format || "wav"
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
