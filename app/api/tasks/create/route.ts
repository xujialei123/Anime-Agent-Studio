import { NextRequest, NextResponse } from "next/server";
import { projectInputSchema } from "@/lib/ai/schema";
import { makeId } from "@/lib/ai/json";
import { createStoryTask } from "@/lib/tasks/factory";
import { saveProject, saveTask } from "@/lib/store/memory";
import type { StoredProject } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = projectInputSchema.parse(body);
    const now = new Date().toISOString();
    const projectId = makeId("project");
    const storyTask = createStoryTask(projectId, input);

    const project: StoredProject = {
      id: projectId,
      input,
      tasks: [],
      assets: [],
      status: "draft",
      createdAt: now,
      updatedAt: now
    };

    saveProject(project);
    saveTask(storyTask);

    return NextResponse.json({ project: { ...project, tasks: [storyTask] }, firstTaskId: storyTask.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
