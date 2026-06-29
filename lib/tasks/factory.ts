import type { AgentTask, AnimeCharacter, AnimeProjectPlan, AnimeScene, NarrationBeat, ProjectInput } from "@/lib/ai/types";
import { makeId } from "@/lib/ai/json";

function isVisualCharacter(character: AnimeCharacter) {
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

function task(partial: Omit<AgentTask, "id" | "status" | "createdAt" | "updatedAt">): AgentTask {
  const now = new Date().toISOString();
  return {
    id: makeId("task"),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ...partial
  };
}

function beatToScene(beat: NarrationBeat, existing?: AnimeScene): AnimeScene {
  const duration = Math.max(2, Number(beat.duration_seconds || existing?.duration_seconds || 4));
  const subtitleText = beat.subtitle_text || beat.narration;
  return {
    scene_id: beat.scene_id,
    beat_id: beat.beat_id,
    time_range: existing?.time_range || `${Math.max(0, beat.order - 1) * duration}-${beat.order * duration}s`,
    duration_seconds: duration,
    scene_purpose: existing?.scene_purpose || "旁白 beat 画面化",
    location: existing?.location || "",
    characters_in_scene: beat.characters_in_scene || existing?.characters_in_scene || [],
    plot: existing?.plot || beat.narration,
    visual_description: existing?.visual_description || beat.visual_must_show,
    camera: existing?.camera || { shot_type: "medium shot", angle: "front angle", movement: "slow push in" },
    action: existing?.action || beat.visual_must_show,
    emotion: existing?.emotion || "tense",
    continuity_from_previous: beat.continuity_from_previous || existing?.continuity_from_previous,
    starting_state: beat.starting_state || existing?.starting_state,
    ending_state: beat.ending_state || existing?.ending_state,
    visual_continuity_anchor: beat.visual_continuity_anchor || existing?.visual_continuity_anchor,
    visual_must_show: beat.visual_must_show || existing?.visual_must_show,
    visual_must_not_show: beat.visual_must_not_show || existing?.visual_must_not_show,
    image_prompt: beat.image_prompt || existing?.image_prompt || beat.visual_must_show,
    image_negative_prompt: beat.image_negative_prompt || existing?.image_negative_prompt || "photorealistic, live action, 3D render, unrelated new scene",
    video_prompt: beat.video_prompt || existing?.video_prompt || `Start from the supplied manga keyframe. Show only subtle motion that matches this narration beat: ${beat.narration}.`,
    video_motion_strength: existing?.video_motion_strength || "low",
    tts: [
      {
        speaker: "旁白",
        type: "narrator",
        voiceType: existing?.tts?.[0]?.voiceType || "dramatic storyteller",
        emotion: existing?.tts?.[0]?.emotion || "tense",
        text: beat.narration,
        speed: existing?.tts?.[0]?.speed || "normal",
        volume: existing?.tts?.[0]?.volume || "normal",
        voiceDesignPrompt: existing?.tts?.[0]?.voiceDesignPrompt || "calm but dramatic Chinese short drama narrator, clear rhythm, suspenseful, cinematic, not shouting"
      }
    ],
    subtitle: [{ start: 0, end: duration, text: subtitleText }],
    sound_design: existing?.sound_design || { sfx: [], bgm: "", transition_sound: "" },
    editing: existing?.editing || { transition: "cut", pace: "narration-driven", text_overlay: subtitleText, special_effects: [] },
    image_url: existing?.image_url,
    video_url: existing?.video_url,
    audio_url: existing?.audio_url
  };
}

function getProductionScenes(plan: AnimeProjectPlan) {
  if (!plan.narration_beats?.length) return plan.scenes;

  const scenesById = new Map(plan.scenes.map((scene) => [scene.scene_id, scene]));
  const scenes = [...plan.narration_beats]
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((beat) => beatToScene(beat, scenesById.get(beat.scene_id)));

  // 后续 runner 会通过 project.plan.scenes 查找视频、音频和最后一帧，所以这里直接把 scenes 规范化成 beat 粒度。
  plan.scenes = scenes;
  plan.project.scene_count = scenes.length;
  return scenes;
}

export function createStoryTask(projectId: string, input: ProjectInput) {
  return task({
    projectId,
    type: "story.generate",
    title: "生成旁白时间轴、角色和分镜方案",
    agent: "story_director",
    dependsOn: [],
    input: { projectInput: input }
  });
}

export function createGenerationTasks(projectId: string, plan: AnimeProjectPlan) {
  const tasks: AgentTask[] = [];
  const characterImageTaskIds = new Map<string, string>();
  let previousVideoTask: AgentTask | undefined;
  const scenes = getProductionScenes(plan);

  for (const character of plan.characters.filter(isVisualCharacter)) {
    const characterTask = task({
      projectId,
      type: "character.image.generate",
      title: `生成角色定稿图：${character.name}`,
      agent: "character_designer",
      dependsOn: [],
      input: { character, visualStyle: plan.visual_style, aspectRatio: plan.project.aspect_ratio }
    });
    tasks.push(characterTask);
    characterImageTaskIds.set(character.name, characterTask.id);
  }

  for (const [index, scene] of scenes.entries()) {
    const characterDependsOn = (scene.characters_in_scene || [])
      .map((name) => characterImageTaskIds.get(name))
      .filter((id): id is string => Boolean(id));

    const imageDependsOn = [...new Set(characterDependsOn)];
    if (previousVideoTask) imageDependsOn.push(previousVideoTask.id);

    const imageTask = task({
      projectId,
      type: "scene.image.generate",
      title: `${scene.beat_id ? "旁白 Beat" : "分镜"} 关键帧：${scene.scene_id}`,
      agent: "image_operator",
      dependsOn: imageDependsOn,
      input: {
        scene,
        visualStyle: plan.visual_style,
        aspectRatio: plan.project.aspect_ratio,
        continuityMode: index === 0 ? "opening_panel" : "new_panel_after_previous_video"
      }
    });
    tasks.push(imageTask);

    const videoTask = task({
      projectId,
      type: "scene.video.generate",
      title: `${scene.beat_id ? "旁白 Beat" : "分镜"} 漫画动效：${scene.scene_id}`,
      agent: "video_operator",
      dependsOn: [imageTask.id],
      input: { sceneId: scene.scene_id, prompt: scene.video_prompt, duration: scene.duration_seconds, aspectRatio: plan.project.aspect_ratio }
    });
    tasks.push(videoTask);
    previousVideoTask = videoTask;

    tasks.push(task({
      projectId,
      type: "scene.tts.generate",
      title: `${scene.beat_id ? "旁白 Beat" : "分镜"} 配音：${scene.scene_id}`,
      agent: "voice_director",
      dependsOn: [],
      input: { sceneId: scene.scene_id, tts: scene.tts }
    }));
  }

  const mergeDeps = tasks
    .filter((item) => item.type === "scene.video.generate" || item.type === "scene.tts.generate")
    .map((item) => item.id);

  tasks.push(task({
    projectId,
    type: "project.merge",
    title: "按旁白时间轴合成最终短剧",
    agent: "render_engineer",
    dependsOn: mergeDeps,
    input: { editingPlan: plan.final_editing_plan }
  }));

  return tasks;
}
