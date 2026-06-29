import { NextRequest, NextResponse } from "next/server";
import { runOneTask, runReadyTasks } from "@/lib/tasks/runner";
import { getProject, getTask } from "@/lib/store/memory";

export const runtime = "nodejs";
export const maxDuration = 300;

function assertTaskAllowed(taskId: string) {
  const task = getTask(taskId);
  const project = getProject(task.projectId);
  if (task.type !== "story.generate" && !project.planApprovedAt) {
    throw new Error("请先在 Studio 中修改并确认剧本/分镜/Prompt，再继续生成图片和配音");
  }
  if (task.type === "scene.video.generate") {
    const sceneId = String(task.input.sceneId || "");
    const scene = project.plan?.scenes.find((item) => item.scene_id === sceneId);
    if (!scene?.image_approved) throw new Error(`请先确认 ${sceneId} 的图片，再生成视频`);
  }
  return task;
}

function findRunnableStoryTask(projectId: string) {
  const project = getProject(projectId);
  return [...project.tasks]
    .reverse()
    .find((task) => task.type === "story.generate" && ["pending", "failed"].includes(task.status));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.taskId) {
      const task = assertTaskAllowed(String(body.taskId));
      const result = await runOneTask(task);
      return NextResponse.json({ task: result, project: getProject(result.projectId) });
    }

    if (body.projectId) {
      const projectId = String(body.projectId);
      const project = getProject(projectId);

      if (!project.plan) {
        const storyTask = findRunnableStoryTask(projectId);
        if (storyTask) {
          const task = await runOneTask(storyTask);
          return NextResponse.json({ project: getProject(projectId), ran: 1, task });
        }
        throw new Error("当前项目没有剧本任务，请重新创建项目");
      }

      if (!project.planApprovedAt) {
        throw new Error("请先修改并确认剧本/分镜/Prompt，再继续执行可运行任务");
      }

      const result = await runReadyTasks(projectId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "缺少 taskId 或 projectId" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
