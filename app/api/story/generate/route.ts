import { NextRequest, NextResponse } from "next/server";
import { projectInputSchema } from "@/lib/ai/schema";
import { buildAnimeDirectorPrompt } from "@/lib/ai/prompts/anime-director";
import { agnesChatCompletion } from "@/lib/providers/agnes";
import { extractJson } from "@/lib/ai/json";
import type { AnimeProjectPlan } from "@/lib/ai/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const input = projectInputSchema.parse(await req.json());
    const raw = await agnesChatCompletion({ prompt: buildAnimeDirectorPrompt(input), temperature: 0.7 });
    const plan = extractJson<AnimeProjectPlan>(raw);
    return NextResponse.json({ plan, raw });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
