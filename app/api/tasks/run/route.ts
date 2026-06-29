import { NextRequest, NextResponse } from "next/server";
import { runOneTask, runReadyTasks } from "@/lib/tasks/runner";
import { getTask } from "@/lib/store/memory";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.taskId) {
      const task = getTask(String(body.taskId));
      const result = await runOneTask(task);
      return NextResponse.json({ task: result });
    }

    if (body.projectId) {
      const result = await runReadyTasks(String(body.projectId));
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "缺少 taskId 或 projectId" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
