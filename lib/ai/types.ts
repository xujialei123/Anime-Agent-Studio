export type AspectRatio = "9:16" | "16:9" | "1:1";

export type ProjectInput = {
  idea: string;
  genre: string;
  style: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  sceneCount: number;
  voiceMode: "built_in" | "voice_design";
  autoRun: boolean;
};

export type VoiceSpec = {
  speaker: string;
  type: "narrator" | "character" | "inner_voice";
  voiceType: string;
  emotion: string;
  text: string;
  speed: "slow" | "normal" | "fast";
  volume: "low" | "normal" | "high";
  voiceDesignPrompt?: string;
};

export type AnimeCharacter = {
  id: string;
  name: string;
  role: string;
  age: string;
  gender: string;
  face: string;
  hair: string;
  body: string;
  outfit: string;
  colors: string[];
  personality: string;
  signature_item: string;
  visual_keywords: string;
  voice: {
    voice_type: string;
    tone: string;
    speed: string;
    emotion_range: string;
    voice_design_prompt?: string;
  };
  speaking_style: string;
  image_url?: string;
};

export type AnimeScene = {
  scene_id: string;
  time_range: string;
  duration_seconds: number;
  scene_purpose: string;
  location: string;
  characters_in_scene: string[];
  plot: string;
  visual_description: string;
  camera: {
    shot_type: string;
    angle: string;
    movement: string;
  };
  action: string;
  emotion: string;
  image_prompt: string;
  image_negative_prompt: string;
  video_prompt: string;
  video_motion_strength: "low" | "medium" | "high";
  tts: VoiceSpec[];
  subtitle: Array<{ start: number; end: number; text: string }>;
  sound_design: {
    sfx: string[];
    bgm: string;
    transition_sound: string;
  };
  editing: {
    transition: string;
    pace: string;
    text_overlay: string;
    special_effects: string[];
  };
  image_url?: string;
  video_url?: string;
  audio_url?: string;
};

export type AnimeProjectPlan = {
  project: {
    title: string;
    genre: string;
    style: string;
    aspect_ratio: AspectRatio;
    language: "zh-CN";
    duration_seconds: number;
    scene_count: number;
    target_platform: string;
    summary: string;
  };
  story: {
    logline: string;
    worldview: string;
    theme: string;
    main_conflict: string;
    hook: string;
    ending_cliffhanger: string;
  };
  characters: AnimeCharacter[];
  visual_style: {
    global_style_prompt: string;
    negative_prompt: string;
    lighting_style: string;
    camera_style: string;
    color_palette: string[];
    quality_keywords: string[];
  };
  episode: {
    episode_number: number;
    episode_title: string;
    episode_summary: string;
    beat_sheet: Array<{ time_range: string; purpose: string; content: string }>;
  };
  scenes: AnimeScene[];
  final_editing_plan: {
    video_order: string[];
    audio_order: string[];
    subtitle_style: string;
    bgm_plan: string;
    sfx_plan: string;
    opening_style: string;
    ending_style: string;
    export_settings: {
      resolution: string;
      fps: number;
      format: string;
    };
  };
  next_episode_teaser: {
    title: string;
    hook: string;
    summary: string;
  };
};

export type TaskType =
  | "story.generate"
  | "character.image.generate"
  | "scene.image.generate"
  | "scene.video.generate"
  | "scene.tts.generate"
  | "project.merge";

export type TaskStatus = "pending" | "running" | "generating" | "succeeded" | "failed" | "skipped";

export type AgentTask = {
  id: string;
  projectId: string;
  type: TaskType;
  title: string;
  agent: string;
  status: TaskStatus;
  dependsOn: string[];
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredProject = {
  id: string;
  input: ProjectInput;
  plan?: AnimeProjectPlan;
  finalVideoUrl?: string;
  tasks: AgentTask[];
  assets: Array<{ id: string; type: string; url: string; meta?: Record<string, unknown> }>;
  status: "draft" | "planned" | "generating" | "done" | "failed";
  createdAt: string;
  updatedAt: string;
};
