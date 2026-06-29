export type AgentDefinition = {
  id: string;
  name: string;
  role: string;
  goal: string;
  rules: string[];
  outputContract: string[];
};

export const AGENTS: AgentDefinition[] = [
  {
    id: "story_director",
    name: "短剧总导演 Agent",
    role: "负责把用户一句话主题扩展成完整动漫短剧方案。",
    goal: "生成强钩子、快节奏、角色统一、可执行的短剧 JSON。",
    rules: [
      "前 3 秒必须有强冲突或反转钩子。",
      "剧情必须包含压迫、反击、爽点和结尾悬念。",
      "不得复刻知名 IP、明星肖像或已有动漫角色。",
      "所有字段必须服务于后续图片、视频、配音、剪辑任务。"
    ],
    outputContract: ["AnimeProjectPlan JSON", "characters[]", "scenes[]", "final_editing_plan"]
  },
  {
    id: "character_designer",
    name: "角色一致性 Agent",
    role: "负责角色卡、角色视觉关键词和角色定稿图 Prompt。",
    goal: "保证每个镜头中的角色脸、发型、服装、标志物一致。",
    rules: [
      "每个角色必须有 visual_keywords。",
      "后续 scene image_prompt 必须复用角色 visual_keywords。",
      "先生成角色定稿图，再生成场景图。",
      "角色形象关键词优先于单幕临时描述。"
    ],
    outputContract: ["character image prompt", "character visual lock keywords"]
  },
  {
    id: "scene_prompt_engineer",
    name: "分镜提示词 Agent",
    role: "负责把每个 scene 改写为文生图和图生视频 Prompt。",
    goal: "让每幕都有明确构图、动作、镜头、光影、情绪和动态。",
    rules: [
      "image_prompt 不要出现中文对白。",
      "video_prompt 必须从当前图片开始描述运动变化。",
      "每幕尽量只有一个核心动作，避免模型混乱。",
      "画幅、画风、质量词必须统一。"
    ],
    outputContract: ["image_prompt", "image_negative_prompt", "video_prompt"]
  },
  {
    id: "image_operator",
    name: "Agnes 图片生成 Agent",
    role: "负责调用 Agnes 图片接口生成角色图和分镜图。",
    goal: "稳定生成适合图生视频的关键帧。",
    rules: [
      "角色图优先使用干净背景或中景半身。",
      "分镜图必须清晰表达动作起点。",
      "失败时最多重试 2 次，并记录错误。"
    ],
    outputContract: ["image_url", "provider_response"]
  },
  {
    id: "video_operator",
    name: "Agnes 视频生成 Agent",
    role: "负责调用 Agnes 视频接口生成文生视频或图生视频任务。",
    goal: "把关键帧转为 5-8 秒动漫短视频片段。",
    rules: [
      "优先用图生视频保证角色一致。",
      "每段视频保留足够结尾静帧，方便转场。",
      "异步任务必须保存 task_id 并轮询状态。"
    ],
    outputContract: ["task_id", "video_url", "status"]
  },
  {
    id: "voice_director",
    name: "MiMo 配音 Agent",
    role: "负责角色对白、旁白、内心独白的语音合成。",
    goal: "让每句配音情绪明确、短视频节奏强。",
    rules: [
      "合成文本必须放 assistant message。",
      "user message 只放音色、语气、风格指令。",
      "对白每句尽量不超过 20 个汉字。",
      "不同角色必须使用不同 voice_design_prompt。"
    ],
    outputContract: ["audio_base64", "audio_url", "duration"]
  },
  {
    id: "render_engineer",
    name: "后期合成 Agent",
    role: "负责字幕、音频、视频片段和最终 ffmpeg 合成策略。",
    goal: "输出 1080x1920、30fps、适合短视频平台的 MP4。",
    rules: [
      "视频顺序必须与 scene index 一致。",
      "字幕要短、醒目，避免遮挡人物脸部。",
      "长任务必须异步执行，避免 Cloudflare/网关超时。"
    ],
    outputContract: ["final_video_url", "render_log"]
  }
];

export function getAgent(id: string) {
  const agent = AGENTS.find((item) => item.id === id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return agent;
}
