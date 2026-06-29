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
    goal: "生成强钩子、快节奏、角色统一、剧情连续、漫画感明确、可执行的短剧 JSON。",
    rules: [
      "前 3 秒必须有强冲突或反转钩子。",
      "剧情必须包含压迫、反击、爽点和结尾悬念。",
      "不得复刻知名 IP、明星肖像或已有动漫角色。",
      "所有字段必须服务于后续图片、视频、配音、剪辑任务。",
      "visual_style 和所有 image/video prompt 必须强制 2D 漫画分镜风，禁止写实、真人、3D、电影实拍感。",
      "每个 scene 必须是上一 scene 的直接结果，必须写清 starting_state、ending_state、continuity_from_previous 和 visual_continuity_anchor。"
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
      "visual_keywords 必须是英文稳定身份锁定词，包含 face shape、eye design、hair silhouette、outfit layers、color palette、signature item。",
      "visual_keywords 不能写临时动作、情绪、光效、受伤状态或剧情事件。",
      "后续 scene image_prompt 和 video_prompt 必须逐字复用角色 visual_keywords。",
      "先生成角色定稿图，再生成每个分镜的漫画关键帧。",
      "角色形象关键词优先于单幕临时描述。"
    ],
    outputContract: ["character image prompt", "character visual lock keywords"]
  },
  {
    id: "scene_prompt_engineer",
    name: "分镜提示词 Agent",
    role: "负责把每个 scene 改写为文生图和图生视频 Prompt。",
    goal: "让每幕都有明确构图、动作、镜头、光影、情绪、漫画分镜感、剧情承接和稳定动态。",
    rules: [
      "image_prompt 不要出现中文对白。",
      "image_prompt 必须是 2D manga comic panel / anime cel shading / ink line art 风格。",
      "image_prompt 必须包含上一幕 ending_state、本幕 starting_state 和 visual_continuity_anchor。",
      "video_prompt 必须从当前图片开始描述运动变化。",
      "video_prompt 必须使用 limited animation、parallax camera、subtle hair and cloth movement、speed lines 或 screentone motion 等漫画动画词。",
      "video_prompt 必须要求最后 0.5-1 秒停在 ending_state，给下一幕作为连续性参考。",
      "每幕尽量只有一个核心动作，避免模型混乱。",
      "画幅、画风、质量词必须统一。",
      "negative prompt 必须排除 photorealistic、live action、3D render、game CG、real skin、western realism。"
    ],
    outputContract: ["image_prompt", "image_negative_prompt", "video_prompt"]
  },
  {
    id: "image_operator",
    name: "Agnes 图片生成 Agent",
    role: "负责调用 Agnes 图片接口生成角色图和分镜图。",
    goal: "稳定生成适合图生视频的漫画关键帧。",
    rules: [
      "角色图优先使用干净背景或中景半身。",
      "每个分镜都必须先生成漫画关键帧，再进入图生视频。",
      "scene_002 之后的关键帧必须参考上一段视频最后一帧，不允许剧情重置。",
      "分镜图必须清晰表达动作起点。",
      "图片必须保持 2D 漫画分镜、清晰线稿、赛璐璐上色、网点纸纹。",
      "失败时最多重试 2 次，并记录错误。"
    ],
    outputContract: ["image_url", "provider_response"]
  },
  {
    id: "video_operator",
    name: "Agnes 视频生成 Agent",
    role: "负责调用 Agnes 视频接口生成文生视频或图生视频任务。",
    goal: "把漫画关键帧转为 5-8 秒动漫漫剧片段。",
    rules: [
      "优先用图生视频保证角色一致。",
      "视频只能做轻量漫画动画：推拉镜头、视差、眨眼、头发衣服微动、速度线、光效微动。",
      "禁止把画面转成写实真人、3D CG、游戏过场或电影实拍。",
      "每段视频必须停在 ending_state 并保留足够结尾静帧，方便下一幕关键帧继续参考。",
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
