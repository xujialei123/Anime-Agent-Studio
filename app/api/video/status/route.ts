import { NextRequest, NextResponse } from "next/server";
import { agnesGetVideoStatus } from "@/lib/providers/agnes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    const videoId = url.searchParams.get("videoId");

    if (!taskId && !videoId) {
      return NextResponse.json({ error: "缺少 taskId 或 videoId" }, { status: 400 });
    }

    const result = await agnesGetVideoStatus({
      taskId: taskId || undefined,
      videoId: videoId || undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
