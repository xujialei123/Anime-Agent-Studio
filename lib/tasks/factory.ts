import type { AgentTask, AnimeCharacter, AnimeProjectPlan, ProjectInput } from "@/lib/ai/types";
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

export function createStoryTask(projectId: string, input: ProjectInput) {
  return task({
    projectId,
    type: "story.generate",
    title: "生成故事、角色和分镜方案",
    agent: "story_director",
    dependsOn: [],
    input: { projectInput: input }
  });
}

export function createGenerationTasks(projectId: string, plan: AnimeProjectPlan) {
  const tasks: AgentTask[] = [];
  const characterImageTaskIds = new Map<string, string>();
  let previousVideoTask: AgentTask | undefined;

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

  for (const [index, scene] of plan.scenes.entries()) {
    const characterDependsOn = (scene.characters_in_scene || [])
      .map((name) => characterImageTaskIds.get(name))
      .filter((id): id is string => Boolean(id));

    const imageDependsOn = [...new Set(characterDependsOn)];
    if (previousVideoTask) imageDependsOn.push(previousVideoTask.id);

    const imageTask = task({
      projectId,
      type: "scene.image.generate",
      title: `生成漫画关键帧：${scene.scene_id}`,
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
      title: `生成漫画图生视频片段：${scene.scene_id}`,
      agent: "video_operator",
      dependsOn: [imageTask.id],
      input: { sceneId: scene.scene_id, prompt: scene.video_prompt, duration: scene.duration_seconds, aspectRatio: plan.project.aspect_ratio }
    });
    tasks.push(videoTask);
    previousVideoTask = videoTask;

    tasks.push(task({
      projectId,
      type: "scene.tts.generate",
      title: `生成配音：${scene.scene_id}`,
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
    title: "合成最终短剧",
    agent: "render_engineer",
    dependsOn: mergeDeps,
    input: { editingPlan: plan.final_editing_plan }
  }));

  return tasks;
}
