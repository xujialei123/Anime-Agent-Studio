import { NextRequest, NextResponse } from "next/server";
import type { AnimeProjectPlan, StoredProject } from "@/lib/ai/types";
import { createMergeTask, createReviewGenerationTasks, createVideoTaskForScene, normalizePlanScenes } from "@/lib/tasks/factory";
import { getProject, replaceProjectTasks, saveProject, saveTask } from "@/lib/store/memory";

type ReviewAction = "update_plan" | "approve_plan" | "update_scene" | "approve_image" | "approve_all_images";

function getStoryTasks(projectId: string) {
  return getProject(projectId).tasks.filter((task) => task.type === "story.generate");
}

function resetGeneratedAssets(plan: AnimeProjectPlan) {
  for (const character of plan.characters || []) character.image_url = undefined;
  for (const scene of plan.scenes || []) {
    scene.image_url = undefined;
    scene.video_url = undefined;
    scene.audio_url = undefined;
    scene.image_approved = false;
  }
  return plan;
}

function getSceneImageFromTaskOrAsset(project: StoredProject, sceneId: string) {
  const sceneAsset = [...project.assets]
    .reverse()
    .find((asset) => asset.type === "scene_image" && asset.meta?.sceneId === sceneId && asset.url);
  if (typeof sceneAsset?.url === "string") return sceneAsset.url;

  const imageTask = [...project.tasks]
    .reverse()
    .find((task) => task.type === "scene.image.generate" && (task.input.scene as { scene_id?: string } | undefined)?.scene_id === sceneId);
  const imageUrl = imageTask?.output?.imageUrl;
  return typeof imageUrl === "string" ? imageUrl : undefined;
}

function syncSceneImagesFromOutputs(project: StoredProject) {
  if (!project.plan) return project;
  for (const scene of project.plan.scenes) {
    if (!scene.image_url) {
      const imageUrl = getSceneImageFromTaskOrAsset(project, scene.scene_id);
      if (imageUrl) scene.image_url = imageUrl;
    }
  }
  saveProject(project);
  return project;
}

function rebuildReviewTasks(projectId: string) {
  const project = getProject(projectId);
  if (!project.plan) throw new Error("项目缺少剧本方案");
  const storyTasks = getStoryTasks(projectId);
  const generationTasks = createReviewGenerationTasks(project.id, project.plan);
  return replaceProjectTasks(projectId, [...storyTasks, ...generationTasks]);
}

function ensureMergeTask(projectId: string) {
  const project = syncSceneImagesFromOutputs(getProject(projectId));
  if (!project.plan) throw new Error("项目缺少剧本方案");
  const exists = project.tasks.some((task) => task.type === "project.merge");
  if (exists) return;
  const task = createMergeTask(project.id, project.plan, project.tasks);
  saveTask(task);
}

function ensureVideoTask(projectId: string, sceneId: string) {
  const project = syncSceneImagesFromOutputs(getProject(projectId));
  if (!project.plan) throw new Error("项目缺少剧本方案");
  const scene = project.plan.scenes.find((item) => item.scene_id === sceneId);
  if (!scene) throw new Error(`分镜不存在：${sceneId}`);
  if (!scene.image_url) throw new Error(`请先生成 ${sceneId} 的图片，再确认生成视频`);
  scene.image_approved = true;
  saveProject(project);

  const exists = project.tasks.some((task) => task.type === "scene.video.generate" && String(task.input.sceneId) === sceneId);
  if (!exists) {
    const imageTask = project.tasks.find((task) => task.type === "scene.image.generate" && (task.input.scene as { scene_id?: string } | undefined)?.scene_id === sceneId);
    const videoTask = createVideoTaskForScene(project.id, project.plan, sceneId, imageTask?.id);
    saveTask(videoTask);
  }

  const latest = syncSceneImagesFromOutputs(getProject(projectId));
  const allGeneratedImagesApproved = latest.plan?.scenes.length
    ? latest.plan.scenes.every((item) => item.image_url && item.image_approved)
    : false;
  if (allGeneratedImagesApproved) ensureMergeTask(projectId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      projectId?: string;
      action?: ReviewAction;
      plan?: AnimeProjectPlan;
      sceneId?: string;
      scene?: Partial<AnimeProjectPlan["scenes"][number]>;
    };

    const projectId = String(body.projectId || "");
    const action = body.action;
    if (!projectId || !action) return NextResponse.json({ error: "缺少 projectId 或 action" }, { status: 400 });

    const project = getProject(projectId);

    if (action === "update_plan") {
      if (!body.plan) return NextResponse.json({ error: "缺少 plan" }, { status: 400 });
      const plan = resetGeneratedAssets(body.plan);
      normalizePlanScenes(plan);
      project.plan = plan;
      project.status = "planned";
      project.finalVideoUrl = undefined;
      project.planApprovedAt = undefined;
      project.generationTasksCreatedAt = undefined;
      project.assets = [];
      saveProject(project);
      const storyTasks = getStoryTasks(projectId);
      const updated = replaceProjectTasks(projectId, storyTasks);
      return NextResponse.json({ project: updated });
    }

    if (action === "approve_plan") {
      if (body.plan) project.plan = body.plan;
      if (!project.plan) throw new Error("请先生成或填写剧本方案");
      normalizePlanScenes(project.plan);
      for (const scene of project.plan.scenes) {
        scene.image_approved = false;
        scene.image_url = undefined;
        scene.video_url = undefined;
        scene.audio_url = undefined;
      }
      for (const character of project.plan.characters) character.image_url = undefined;
      project.status = "planned";
      project.finalVideoUrl = undefined;
      project.planApprovedAt = new Date().toISOString();
      project.generationTasksCreatedAt = project.planApprovedAt;
      project.assets = [];
      saveProject(project);
      const updated = rebuildReviewTasks(projectId);
      return NextResponse.json({ project: updated });
    }

    if (action === "update_scene") {
      if (!project.plan) throw new Error("项目缺少剧本方案");
      const sceneId = String(body.sceneId || body.scene?.scene_id || "");
      if (!sceneId) return NextResponse.json({ error: "缺少 sceneId" }, { status: 400 });
      const index = project.plan.scenes.findIndex((scene) => scene.scene_id === sceneId);
      if (index < 0) throw new Error(`分镜不存在：${sceneId}`);
      project.plan.scenes[index] = {
        ...project.plan.scenes[index],
        ...body.scene,
        scene_id: sceneId,
        image_url: undefined,
        video_url: undefined,
        audio_url: undefined,
        image_approved: false
      };
      project.finalVideoUrl = undefined;
      project.assets = project.assets.filter((asset) => asset.meta?.sceneId !== sceneId && asset.type !== "final_video");
      const beatId = project.plan.scenes[index].beat_id;
      if (beatId && project.plan.narration_beats?.length) {
        const beatIndex = project.plan.narration_beats.findIndex((beat) => beat.beat_id === beatId);
        if (beatIndex >= 0) {
          project.plan.narration_beats[beatIndex] = {
            ...project.plan.narration_beats[beatIndex],
            narration: project.plan.scenes[index].tts?.[0]?.text || project.plan.narration_beats[beatIndex].narration,
            image_prompt: project.plan.scenes[index].image_prompt,
            image_negative_prompt: project.plan.scenes[index].image_negative_prompt,
            video_prompt: project.plan.scenes[index].video_prompt,
            visual_must_show: project.plan.scenes[index].visual_must_show || project.plan.narration_beats[beatIndex].visual_must_show,
            visual_must_not_show: project.plan.scenes[index].visual_must_not_show || project.plan.narration_beats[beatIndex].visual_must_not_show,
            subtitle_text: project.plan.scenes[index].subtitle?.[0]?.text || project.plan.narration_beats[beatIndex].subtitle_text
          };
        }
      }
      saveProject(project);
      if (project.planApprovedAt) return NextResponse.json({ project: rebuildReviewTasks(projectId) });
      return NextResponse.json({ project });
    }

    if (action === "approve_image") {
      if (!project.planApprovedAt) throw new Error("请先确认剧本，再确认图片");
      ensureVideoTask(projectId, String(body.sceneId || ""));
      return NextResponse.json({ project: syncSceneImagesFromOutputs(getProject(projectId)) });
    }

    if (action === "approve_all_images") {
      if (!project.planApprovedAt) throw new Error("请先确认剧本，再确认图片");
      if (!project.plan) throw new Error("项目缺少剧本方案");
      syncSceneImagesFromOutputs(project);
      for (const scene of project.plan.scenes) {
        if (scene.image_url) ensureVideoTask(projectId, scene.scene_id);
      }
      return NextResponse.json({ project: syncSceneImagesFromOutputs(getProject(projectId)) });
    }

    return NextResponse.json({ error: `未知 action：${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
