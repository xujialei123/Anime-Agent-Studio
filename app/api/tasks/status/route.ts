import { NextRequest, NextResponse } from "next/server";
import type { StoredProject } from "@/lib/ai/types";
import { getProject, getTask, projectStore } from "@/lib/store/memory";
import { reconcileVideoTaskStatus } from "@/lib/tasks/runner";

export const runtime = "nodejs";

const STATUS_RECHECK_INTERVAL_MS = 20_000;
const FRAME_RETRY_INTERVAL_MS = 60_000;

function shouldRecheckVideoStatus(task: StoredProject["tasks"][number]) {
  const isRecoverableRateLimitFailure =
    task.status === "failed" && typeof task.error === "string" && /HTTP 429|rate limit/i.test(task.error);
  const isRecoverableFrameFailure =
    task.status === "failed" && task.output?.status === "video_succeeded_frame_extract_failed";
  if (task.type !== "scene.video.generate" || (task.status !== "generating" && !isRecoverableRateLimitFailure && !isRecoverableFrameFailure)) return false;

  if (isRecoverableFrameFailure) {
    const retriedAt = typeof task.output?.lastFrameRetryAt === "string" ? Date.parse(task.output.lastFrameRetryAt) : 0;
    return !retriedAt || Date.now() - retriedAt >= FRAME_RETRY_INTERVAL_MS;
  }

  const checkedAt = typeof task.output?.lastStatusCheckedAt === "string" ? Date.parse(task.output.lastStatusCheckedAt) : 0;
  return !checkedAt || Date.now() - checkedAt >= STATUS_RECHECK_INTERVAL_MS;
}

function sceneIdFromImageTask(task: StoredProject["tasks"][number]) {
  return (task.input.scene as { scene_id?: string } | undefined)?.scene_id;
}

function syncSceneMediaFromOutputs(project: StoredProject): StoredProject {
  if (!project.plan) return project;
  const images = new Map<string, string>();
  const videos = new Map<string, string>();

  for (const asset of project.assets) {
    if (asset.type === "scene_image" && typeof asset.meta?.sceneId === "string") images.set(asset.meta.sceneId, asset.url);
    if (asset.type === "scene_video" && typeof asset.meta?.sceneId === "string") videos.set(asset.meta.sceneId, asset.url);
  }

  for (const task of project.tasks) {
    if (task.type === "scene.image.generate") {
      const sceneId = sceneIdFromImageTask(task);
      const imageUrl = typeof task.output?.imageUrl === "string" ? task.output.imageUrl : undefined;
      if (sceneId && imageUrl) images.set(sceneId, imageUrl);
    }
    if (task.type === "scene.video.generate") {
      const sceneId = typeof task.input.sceneId === "string" ? task.input.sceneId : undefined;
      const videoUrl = typeof task.output?.videoUrl === "string" ? task.output.videoUrl : undefined;
      if (sceneId && videoUrl) videos.set(sceneId, videoUrl);
    }
  }

  project.plan.scenes = project.plan.scenes.map((scene) => ({
    ...scene,
    image_url: scene.image_url || images.get(scene.scene_id),
    video_url: scene.video_url || videos.get(scene.scene_id)
  }));
  return project;
}

function compactProject(project: StoredProject): StoredProject {
  const synced = syncSceneMediaFromOutputs(project);
  return {
    ...synced,
    plan: synced.plan
      ? {
          ...synced.plan,
          scenes: synced.plan.scenes.map((scene) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { audio_url, ...rest } = scene;
            return rest as Omit<typeof scene, "audio_url">;
          }),
        }
      : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");

    if (taskId) {
      const task = getTask(taskId);
      if (shouldRecheckVideoStatus(task)) await reconcileVideoTaskStatus(task, { continueReadyTasks: true });
      return NextResponse.json({ task: getTask(taskId) });
    }

    if (projectId) {
      const project = getProject(projectId);
      const taskToRecheck = project.tasks.find(shouldRecheckVideoStatus);
      if (taskToRecheck) {
        await reconcileVideoTaskStatus(taskToRecheck, { continueReadyTasks: true });
      }
      return NextResponse.json({ project: compactProject(getProject(projectId)) });
    }

    return NextResponse.json({
      projects: Array.from(projectStore.values()).reverse().map(compactProject),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 404 });
  }
}
