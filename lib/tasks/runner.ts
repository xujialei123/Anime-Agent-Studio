import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AgentTask, AnimeCharacter, AnimeProjectPlan, VoiceSpec, StoredProject } from "@/lib/ai/types";
import { buildAnimeDirectorPrompt } from "@/lib/ai/prompts/anime-director";
import { extractJson, makeId } from "@/lib/ai/json";
import { agnesChatCompletion, agnesCreateVideo, agnesGenerateImage, agnesGetVideoStatus } from "@/lib/providers/agnes";
import { mimoGenerateSpeech } from "@/lib/providers/mimo";
import { uploadImageToSupabase } from "@/lib/providers/supabase-storage";
import { getProject, saveProject, saveTask } from "@/lib/store/memory";
import { createGenerationTasks } from "@/lib/tasks/factory";

function isVisualCharacter(character: Pick<AnimeCharacter, "name" | "role" | "face" | "hair" | "body" | "outfit" | "visual_keywords">) {
  const text = [
    character.name,
    character.role,
    character.face,
    character.hair,
    character.body,
    character.outfit,
    character.visual_keywords
  ].join(" ").toLowerCase();

  if (["旁白", "叙事", "narrator", "voice", "tts"].some((keyword) => text.includes(keyword))) return false;

  const invalidValues = new Set(["", "n/a", "na", "none", "null", "无", "不适用"]);
  return !invalidValues.has(String(character.visual_keywords || "").trim().toLowerCase());
}

async function download(url: string, filePath: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8" },
        signal: AbortSignal.timeout(120_000)
      });
      if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`);
      if (!res.body) throw new Error(`下载失败：响应没有内容 ${url}`);

      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(filePath));
      return;
    } catch (error) {
      lastError = error;
      await rm(filePath, { force: true }).catch(() => undefined);
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }

  throw new Error(`视频下载重试 4 次后仍失败：${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
    const ffmpeg = spawn(ffmpegPath, args);
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    ffmpeg.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(`找不到 ffmpeg：${ffmpegPath}。请安装 ffmpeg，或在 .env.local 里把 FFMPEG_PATH 配置为 ffmpeg.exe 的绝对路径。`));
        return;
      }
      reject(error);
    });
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

async function extractAndUploadLastFrame(videoUrl: string, projectId: string, sceneId: string) {
  const dir = await mkdtemp(join(tmpdir(), "anime-last-frame-"));
  try {
    const videoPath = join(dir, "scene.mp4");
    const framePath = join(dir, "last-frame.png");

    await download(videoUrl, videoPath);
    await runFfmpeg([
      "-y",
      "-sseof", "-0.35",
      "-i", videoPath,
      "-frames:v", "1",
      framePath
    ]);

    const buffer = await readFile(framePath);
    return uploadImageToSupabase(buffer, `frames/${projectId}/${sceneId}-last-frame.png`);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const VIDEO_STATUS_INITIAL_DELAY_MS = 15_000;
const VIDEO_STATUS_NORMAL_DELAY_MS = 20_000;
const VIDEO_STATUS_MAX_DELAY_MS = 120_000;
const VIDEO_STATUS_TIMEOUT_MS = 30 * 60 * 1000;
const VIDEO_DONE_STATUSES = ["succeeded", "success", "completed", "finished"];
const VIDEO_FAILED_STATUSES = ["failed", "error", "cancelled"];

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("HTTP 429") || /rate limit/i.test(message);
}

function isContentPolicyViolation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /content_policy_violation|unable to generate this content/i.test(message);
}

function getTaskOutputString(task: AgentTask, key: string) {
  const value = task.output?.[key];
  return typeof value === "string" ? value : undefined;
}

function canReconcileVideoTask(task: AgentTask) {
  if (task.type !== "scene.video.generate") return false;
  if (task.status === "generating") return true;
  if (task.status !== "failed") return false;
  return isRateLimitError(task.error || "") || task.output?.status === "video_succeeded_frame_extract_failed";
}

async function completeVideoTask(
  task: AgentTask,
  sceneId: string,
  projectId: string,
  videoUrl: string
) {
  const latestProject = getProject(projectId);
  const sceneIndex = latestProject.plan?.scenes.findIndex((item) => item.scene_id === sceneId) ?? -1;
  const currentScene = sceneIndex >= 0 ? latestProject.plan?.scenes[sceneIndex] : undefined;
  const nextScene = latestProject.plan?.scenes[sceneIndex + 1];
  let lastFrameUrl: string | undefined;

  if (currentScene) currentScene.video_url = videoUrl;
  const hasVideoAsset = latestProject.assets.some((asset) => asset.type === "scene_video" && asset.url === videoUrl);
  if (!hasVideoAsset) {
    latestProject.assets.push({ id: makeId("asset"), type: "scene_video", url: videoUrl, meta: { sceneId } });
  }
  saveProject(latestProject);

  if (nextScene) {
    try {
      lastFrameUrl = await extractAndUploadLastFrame(videoUrl, projectId, sceneId);
    } catch (error) {
      task.output = {
        ...(task.output || {}),
        status: "video_succeeded_frame_extract_failed",
        videoUrl,
        lastFrameError: error instanceof Error ? error.message : String(error),
        lastFrameRetryAt: new Date().toISOString()
      };
      task.status = "failed";
      task.error = `视频已生成，但抽取最后一帧失败：${error instanceof Error ? error.message : String(error)}`;
      saveTask(task);
      return;
    }

    nextScene.image_url = lastFrameUrl;
    latestProject.assets.push({ id: makeId("asset"), type: "scene_last_frame", url: lastFrameUrl, meta: { sceneId, nextSceneId: nextScene.scene_id } });
  }

  saveProject(latestProject);

  task.output = { ...(task.output || {}), status: "succeeded", videoUrl, lastFrameUrl };
  task.status = "succeeded";
  task.error = undefined;
  saveTask(task);
}

export async function reconcileVideoTaskStatus(task: AgentTask, options: { continueReadyTasks?: boolean } = {}) {
  if (!canReconcileVideoTask(task)) return task;

  const providerTaskId = getTaskOutputString(task, "taskId");
  const videoId = getTaskOutputString(task, "videoId");
  const sceneId = String(task.input.sceneId || "");
  const completedVideoUrl = getTaskOutputString(task, "videoUrl");

  if (task.output?.status === "video_succeeded_frame_extract_failed" && completedVideoUrl) {
    await completeVideoTask(task, sceneId, task.projectId, completedVideoUrl);
    if (task.status === "succeeded" && options.continueReadyTasks) {
      runReadyTasks(task.projectId).catch((err) => console.error("[reconcileVideoTaskStatus] continue tasks failed:", err));
    }
    return task;
  }

  if (!providerTaskId && !videoId) return task;

  try {
    const checked = await agnesGetVideoStatus({ taskId: providerTaskId, videoId });
    const status = checked.status;
    const videoUrl = checked.videoUrl;

    if (videoUrl || VIDEO_DONE_STATUSES.includes(status.toLowerCase())) {
      if (!videoUrl) throw new Error("Agnes video completed but did not return video URL");
      await completeVideoTask(task, sceneId, task.projectId, videoUrl);
      if (options.continueReadyTasks) {
        runReadyTasks(task.projectId).catch((err) => console.error("[reconcileVideoTaskStatus] continue tasks failed:", err));
      }
      return task;
    }

    if (VIDEO_FAILED_STATUSES.includes(status.toLowerCase())) {
      task.status = "failed";
      task.error = `Video generation failed: ${status}`;
      saveTask(task);
      return task;
    }

    task.status = "generating";
    task.error = undefined;
    task.output = { ...(task.output || {}), status, lastStatusCheckedAt: new Date().toISOString() };
    saveTask(task);
    return task;
  } catch (err) {
    if (isRateLimitError(err)) {
      task.output = {
        ...(task.output || {}),
        status: "generating",
        lastStatusError: err instanceof Error ? err.message : String(err),
        lastStatusCheckedAt: new Date().toISOString()
      };
      saveTask(task);
      return task;
    }

    task.error = err instanceof Error ? err.message : String(err);
    saveTask(task);
    return task;
  }
}

async function pollVideoStatus(
  taskId: string,
  videoId: string | undefined,
  sceneId: string,
  projectId: string,
  task: AgentTask,
  createdTaskId: string
) {
  const startedAt = Date.now();
  let delayMs = VIDEO_STATUS_INITIAL_DELAY_MS;
  let timeout: NodeJS.Timeout | undefined;

  const scheduleNext = () => {
    timeout = setTimeout(check, delayMs);
  };

  const finishAsFailed = (error: string) => {
    if (timeout) clearTimeout(timeout);
    task.status = "failed";
    task.error = error;
    saveTask(task);
  };

  const check = async () => {
    if (Date.now() - startedAt > VIDEO_STATUS_TIMEOUT_MS) {
      finishAsFailed("Video generation timed out after 30 minutes");
      return;
    }

    try {
      task.output = { ...(task.output || {}), taskId: createdTaskId, videoId };
      const beforeStatus = task.status;
      await reconcileVideoTaskStatus(task, { continueReadyTasks: true });
      delayMs = VIDEO_STATUS_NORMAL_DELAY_MS;

      if (task.status === "succeeded") {
        if (timeout) clearTimeout(timeout);
        return;
      }

      if (task.status === "failed") {
        if (timeout) clearTimeout(timeout);
        return;
      }

      if (beforeStatus !== "generating") task.status = "generating";
      scheduleNext();
    } catch (err) {
      if (isRateLimitError(err)) {
        delayMs = Math.min(delayMs * 2, VIDEO_STATUS_MAX_DELAY_MS);
        task.output = {
          ...(task.output || {}),
          status: "generating",
          lastStatusError: err instanceof Error ? err.message : String(err),
          nextStatusCheckDelayMs: delayMs,
          lastStatusCheckedAt: new Date().toISOString()
        };
        saveTask(task);
        scheduleNext();
        return;
      }

      finishAsFailed(err instanceof Error ? err.message : String(err));
      console.error("[pollVideoStatus] poll error:", err);
    }
  };

  scheduleNext();
}

function canRun(task: AgentTask, tasks: AgentTask[]) {
  for (const depId of task.dependsOn) {
    const dep = tasks.find((item) => item.id === depId);
    if (!dep || dep.status !== "succeeded") return false;

    if (dep.type === "scene.video.generate") {
      const output = dep.output as Record<string, unknown> | undefined;
      if (!output?.videoUrl) return false;
    }
  }
  return task.status === "pending";
}

export async function runOneTask(task: AgentTask) {
  task.status = "running";
  saveTask(task);

  try {
    const project = getProject(task.projectId);

    if (task.type === "story.generate") {
      const prompt = buildAnimeDirectorPrompt(project.input);
      const raw = await agnesChatCompletion({ prompt, temperature: 0.7 });
      const plan = extractJson<AnimeProjectPlan>(raw);
      project.plan = plan;
      project.status = "planned";
      saveProject(project);

      const generationTasks = createGenerationTasks(project.id, plan);
      for (const item of generationTasks) saveTask(item);

      task.output = { plan, raw };
    }

    if (task.type === "character.image.generate") {
      const character = task.input.character as AnimeCharacter;
      if (!isVisualCharacter(character)) {
        task.status = "skipped";
        task.output = { reason: "non_visual_character", characterName: character.name };
        saveTask(task);
        return task;
      }

      const visualStyle = task.input.visualStyle as { global_style_prompt?: string; negative_prompt?: string };
      const prompt = [
        character.visual_keywords,
        character.face,
        character.hair,
        character.outfit,
        `signature item: ${character.signature_item}`,
        "anime character sheet, clean background, front view, half body, consistent face, detailed eyes",
        visualStyle.global_style_prompt,
        "masterpiece, high detail, sharp line art"
      ].filter(Boolean).join(", ");
      const result = await agnesGenerateImage({
        prompt,
        negativePrompt: visualStyle.negative_prompt,
        aspectRatio: String(task.input.aspectRatio || "9:16")
      });
      task.output = { imageUrl: result.url, provider: result.raw };

      if (project.plan) {
        const target = project.plan.characters.find((item) => item.name === character.name);
        if (target) target.image_url = result.url;
        project.assets.push({ id: makeId("asset"), type: "character_image", url: result.url, meta: { characterName: character.name } });
        saveProject(project);
      }
    }

    if (task.type === "scene.image.generate") {
      const scene = task.input.scene as {
        scene_id: string;
        image_prompt: string;
        image_negative_prompt?: string;
        characters_in_scene?: string[];
      };
      const visualStyle = task.input.visualStyle as { global_style_prompt?: string; negative_prompt?: string };
      const referenceImageUrls =
        project.plan?.characters
          .filter((character) => scene.characters_in_scene?.includes(character.name) && character.image_url)
          .map((character) => character.image_url as string) || [];

      const result = await agnesGenerateImage({
        prompt: `${scene.image_prompt}, ${visualStyle.global_style_prompt || ""}`,
        negativePrompt: scene.image_negative_prompt || visualStyle.negative_prompt,
        aspectRatio: String(task.input.aspectRatio || "9:16"),
        imageUrls: referenceImageUrls
      });
      task.output = { imageUrl: result.url, provider: result.raw };

      if (project.plan) {
        const target = project.plan.scenes.find((item) => item.scene_id === scene.scene_id);
        if (target) target.image_url = result.url;
        project.assets.push({ id: makeId("asset"), type: "scene_image", url: result.url, meta: { sceneId: scene.scene_id } });
        saveProject(project);
      }
    }

    if (task.type === "scene.video.generate") {
      const sceneId = String(task.input.sceneId);
      const sceneIndex = project.plan?.scenes.findIndex((item) => item.scene_id === sceneId) ?? -1;
      const scene = sceneIndex >= 0 ? project.plan?.scenes[sceneIndex] : undefined;
      const previousScene = sceneIndex > 0 ? project.plan?.scenes[sceneIndex - 1] : undefined;
      const nextScene = project.plan?.scenes[sceneIndex + 1];
      const imageUrl = scene?.image_url;

      if (!imageUrl) {
        throw new Error(`缺少 ${sceneId} 的图生视频起始帧 URL`);
      }

      const promptParams = {
        basePrompt: String(task.input.prompt),
        characters: collectSceneCharacters(project.plan, scene, previousScene),
        scene,
        previousScene,
        nextScene,
        visualStyle: project.plan?.visual_style
      };
      const videoPrompt = buildContinuityVideoPrompt(promptParams);

      let submittedPrompt = videoPrompt;
      let usedPolicyFallback = false;
      let created;
      try {
        created = await agnesCreateVideo({
          prompt: submittedPrompt,
          imageUrl,
          durationSeconds: Number(task.input.duration || 6),
          aspectRatio: String(task.input.aspectRatio || "9:16")
        });
      } catch (error) {
        if (!isContentPolicyViolation(error)) throw error;
        submittedPrompt = buildPolicySafeVideoPrompt(promptParams);
        usedPolicyFallback = true;
        created = await agnesCreateVideo({
          prompt: submittedPrompt,
          imageUrl,
          durationSeconds: Number(task.input.duration || 6),
          aspectRatio: String(task.input.aspectRatio || "9:16")
        });
      }

      task.output = {
        taskId: created.taskId,
        videoId: created.videoId,
        status: "generating",
        imageUrl,
        prompt: submittedPrompt,
        originalPrompt: usedPolicyFallback ? videoPrompt : undefined,
        usedPolicyFallback
      };
      task.status = "generating";
      saveTask(task);

      pollVideoStatus(created.taskId, created.videoId, sceneId, project.id, task, created.taskId).catch(console.error);
      return task;
    }

    if (task.type === "scene.tts.generate") {
      const sceneId = String(task.input.sceneId);
      const ttsItems = task.input.tts as VoiceSpec[];
      const audios: Array<{ speaker: string; base64: string; format: string }> = [];

      for (const tts of ttsItems) {
        const speech = await mimoGenerateSpeech({
          text: tts.text,
          styleInstruction: `${tts.emotion}, ${tts.speed}, ${tts.volume}, ${tts.voiceType}`,
          voiceDesignPrompt: tts.voiceDesignPrompt || tts.voiceType,
          useVoiceDesign: true,
          format: "wav"
        });
        audios.push({ speaker: tts.speaker, base64: speech.base64, format: speech.format });
      }

      task.output = { audios, sceneId };
    }

    if (task.type === "project.merge") {
      const videos = project.plan?.scenes.map((scene) => scene.video_url).filter(Boolean) || [];
      const audios = project.plan?.scenes.map((scene) => scene.audio_url).filter(Boolean) || [];
      task.output = {
        finalVideoUrl: videos[0] || null,
        renderPlan: task.input.editingPlan,
        videos,
        audios,
        note: "Demo 版未执行 ffmpeg 合成；生产环境请接入 /api/render/merge 或独立 Worker。"
      };
      project.status = "done";
      saveProject(project);
    }

    task.status = "succeeded";
    saveTask(task);
    return task;
  } catch (error) {
    task.status = "failed";
    task.error = error instanceof Error ? error.message : String(error);
    saveTask(task);
    return task;
  }
}

export async function runReadyTasks(projectId: string) {
  const project = getProject(projectId);
  project.status = "generating";
  saveProject(project);

  let ran = 0;
  let progress = true;

  while (progress) {
    progress = false;
    const latest = getProject(projectId);
    for (const task of latest.tasks) {
      if (canRun(task, latest.tasks)) {
        await runOneTask(task);
        ran++;
        progress = true;
      }
    }
  }

  return { project: getProject(projectId), ran };
}

type ContinuityScene = {
  scene_id: string;
  plot?: string;
  action?: string;
  emotion?: string;
  location?: string;
  visual_description?: string;
  characters_in_scene?: string[];
  camera?: { shot_type?: string; angle?: string; movement?: string };
};

function collectSceneCharacters(
  plan: AnimeProjectPlan | undefined,
  scene: ContinuityScene | undefined,
  previousScene: ContinuityScene | undefined
) {
  const sceneNames = new Set([...(scene?.characters_in_scene || []), ...(previousScene?.characters_in_scene || [])]);
  const visualCharacters = plan?.characters.filter(isVisualCharacter) || [];
  if (sceneNames.size === 0) return visualCharacters;
  return visualCharacters.filter((character) => sceneNames.has(character.name));
}

function describeCharacterLock(character: AnimeCharacter) {
  const colors = character.colors?.length ? `colors: ${character.colors.join(", ")}` : "";
  return [
    character.name,
    character.visual_keywords,
    character.face && `face: ${character.face}`,
    character.hair && `hair: ${character.hair}`,
    character.body && `body: ${character.body}`,
    character.outfit && `outfit: ${character.outfit}`,
    colors,
    character.signature_item && `signature item: ${character.signature_item}`
  ].filter(Boolean).join("; ");
}

function compactText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function removePolicySensitiveTerms(value: string | undefined) {
  return compactText(value)
    .replace(/\b(blood(?:y)?|gore|kill(?:ed|ing)?|murder|dead|death|dying|attack|fight(?:ing)?|combat|violent|violence|weapon|sword|knife|gun|bullet|explosion|torture|wound(?:ed)?|injury|nude|naked|sexual)\b/gi, "")
    .replace(/(血腥|鲜血|流血|杀死|杀害|死亡|尸体|攻击|战斗|打斗|暴力|武器|刀剑|枪械|子弹|爆炸|折磨|伤口|受伤|裸体|色情)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function describePolicySafeCharacterLock(character: AnimeCharacter) {
  return [
    character.name,
    removePolicySensitiveTerms(character.face),
    removePolicySensitiveTerms(character.hair),
    removePolicySensitiveTerms(character.outfit),
    character.colors?.length ? `colors: ${character.colors.join(", ")}` : ""
  ].filter(Boolean).join("; ");
}

function buildPolicySafeVideoPrompt(params: {
  basePrompt: string;
  characters: AnimeCharacter[];
  scene?: ContinuityScene;
  previousScene?: ContinuityScene;
  nextScene?: ContinuityScene;
  visualStyle?: AnimeProjectPlan["visual_style"];
}) {
  const characterLock = params.characters.map(describePolicySafeCharacterLock).filter(Boolean).join(" | ");
  const safeStyle = removePolicySensitiveTerms(params.visualStyle?.global_style_prompt);
  return [
    "Create a family-friendly, calm anime animation from the supplied reference image.",
    "Use the supplied image as the exact first frame and a strict visual identity reference.",
    characterLock ? `Keep these character appearances unchanged: ${characterLock}.` : "Keep every character appearance unchanged.",
    safeStyle ? `Visual style: ${safeStyle}.` : "Preserve the existing anime art style, colors, lighting, and background.",
    "Animate only subtle natural breathing, one gentle blink, slight hair and fabric movement, and a slow steady camera movement.",
    "Keep the mood neutral and peaceful with ordinary non-confrontational motion.",
    "Do not introduce new people, objects, costume changes, scene changes, or dramatic events.",
    "Maintain stable faces, anatomy, clothing, colors, composition, and background throughout.",
    "Finish with a clear stable frame for 1 second, showing every visible character completely and unobstructed."
  ].join(" ");
}

function buildContinuityVideoPrompt(params: {
  basePrompt: string;
  characters: AnimeCharacter[];
  scene?: ContinuityScene;
  previousScene?: ContinuityScene;
  nextScene?: ContinuityScene;
  visualStyle?: AnimeProjectPlan["visual_style"];
}) {
  const characterLock = params.characters.map(describeCharacterLock).filter(Boolean).join(" | ");
  const styleLock = [
    params.visualStyle?.global_style_prompt,
    params.visualStyle?.lighting_style && `lighting: ${params.visualStyle.lighting_style}`,
    params.visualStyle?.camera_style && `camera style: ${params.visualStyle.camera_style}`,
    params.visualStyle?.color_palette?.length ? `palette: ${params.visualStyle.color_palette.join(", ")}` : "",
    params.visualStyle?.quality_keywords?.length ? params.visualStyle.quality_keywords.join(", ") : ""
  ].filter(Boolean).join(", ");
  const currentCamera = [
    params.scene?.camera?.shot_type,
    params.scene?.camera?.angle,
    params.scene?.camera?.movement
  ].filter(Boolean).join(", ");
  const parts = [
    "Start from the supplied reference image, which is the exact first frame for this shot.",
    "Treat the supplied reference image as a hard identity anchor. Do not redesign any character.",
    characterLock ? `Character identity lock: ${characterLock}.` : "",
    styleLock ? `Style lock: ${styleLock}.` : "",
    "Preserve the exact same face shape, eye design, hair silhouette, outfit layers, outfit colors, body proportions, signature items, line art, lighting, location continuity, and anime style from the first frame.",
    "Use one clear motion only. Keep movement coherent and physically continuous. Avoid sudden identity changes, face drift, outfit changes, hair changes, color shifts, camera jumps, morphing, flicker, warped hands, duplicated people, or extra characters.",
    params.previousScene
      ? `Continue from previous shot ${params.previousScene.scene_id}: ${compactText(`${params.previousScene.plot || ""} ${params.previousScene.action || ""} ${params.previousScene.emotion || ""} ${params.previousScene.location || ""}`)}. The first 0.5 seconds should visually match the previous final frame before the new motion begins.`
      : "This is the opening shot, establish the scene clearly before motion begins.",
    `Current scene ${params.scene?.scene_id || ""}: ${compactText(`${params.scene?.plot || ""} ${params.scene?.visual_description || ""} ${params.scene?.action || ""} ${params.scene?.emotion || ""} ${params.scene?.location || ""}`)}.`,
    currentCamera ? `Camera: ${currentCamera}. Keep the camera motion smooth and restrained.` : "Keep the camera motion smooth and restrained.",
    params.nextScene
      ? `End with a stable final frame that can become the first frame of next scene ${params.nextScene.scene_id}: ${compactText(`${params.nextScene.plot || ""} ${params.nextScene.location || ""}`)}. Hold the final composition for 0.5 to 1 second. The final held frame must show every visible character in this shot clearly and completely, with full head, face, hair, outfit, hands, signature item, and body silhouette readable; avoid cropped faces, cut-off heads, off-screen bodies, backs turned to camera, occlusion, motion blur, fade to black, or transition effects.`
      : "End on a stable final frame suitable for the episode ending. The final held frame must show every visible character clearly and completely, with full head, face, hair, outfit, hands, signature item, and body silhouette readable; avoid cropped faces, cut-off heads, off-screen bodies, backs turned to camera, occlusion, motion blur, fade to black, or transition effects.",
    params.visualStyle?.negative_prompt ? `Negative constraints: ${params.visualStyle.negative_prompt}.` : "",
    params.basePrompt
  ];

  return parts.filter(Boolean).join(" ");
}
