import type { ProjectInput } from "@/lib/ai/types";

const HARD_MANGA_STYLE = [
  "2D Japanese manga comic panel style",
  "clean black ink line art",
  "anime cel shading",
  "flat color blocks",
  "screentone texture",
  "comic panel composition",
  "expressive anime eyes",
  "hand-drawn illustration look",
  "limited animation ready keyframe",
  "vertical short drama storyboard"
].join(", ");

const HARD_NEGATIVE_STYLE = [
  "photorealistic",
  "live action",
  "real person",
  "3D render",
  "game CG",
  "cinematic realism",
  "real skin texture",
  "doll-like plastic skin",
  "western realistic comic",
  "oil painting",
  "watermark",
  "logo",
  "text on image",
  "extra fingers",
  "deformed hands",
  "face drift",
  "outfit change",
  "hair style change",
  "identity change",
  "scene reset",
  "unrelated new scene",
  "sudden time jump"
].join(", ");

export function buildAnimeDirectorPrompt(input: ProjectInput) {
  const userDirectorPrompt = input.directorPrompt?.trim();

  return `你是一个专业的“动漫短剧 AI 总导演”。

你的任务：根据用户创意，生成一套“旁白时间轴驱动”的 AI 漫剧制作 JSON。

必须严格输出合法 JSON，不要 Markdown，不要解释，不要代码块。

【用户创意】
${input.idea}

【用户自定义总导演 Prompt】
以下内容是用户在页面里自己写的创作要求，优先级高于默认模板，但不能违反 JSON 输出结构、角色一致性、版权和安全要求。
${userDirectorPrompt || "用户未填写自定义 Prompt，请使用下面默认模板。"}

【制作参数】
- 类型：${input.genre}
- 用户输入画风：${input.style}
- 总时长：${input.durationSeconds} 秒
- beat / 分镜数量：${input.sceneCount}
- 画幅比例：${input.aspectRatio}
- 配音模式：${input.voiceMode === "voice_design" ? "MiMo voice design 自定义音色" : "MiMo 内置音色"}
- 语言：中文

【默认模板规则】
1. 本项目采用旁白漫剧 / 动态漫画模式，不让视频模型自由演剧情。
2. 必须先把整集拆成 narration_beats：一句旁白 = 一个画面任务 = 一个视频任务 = 一个合成片段。
3. 每个 beat 的画面只服务这一句旁白，不能画面讲 A、旁白讲 B。
4. narration_beats.length 必须等于 ${input.sceneCount}。
5. scenes.length 也必须等于 ${input.sceneCount}，并且 scenes[i] 必须和 narration_beats[i] 一一对应。
6. 每个 scene.scene_id 必须等于对应 narration_beat.scene_id。
7. 每个 scene.tts[0].text 必须等于对应 narration_beat.narration。
8. 每个 scene.image_prompt 必须直接表现对应 narration_beat.visual_must_show。
9. 每个 scene.video_prompt 只能做对应 narration_beat 的轻微漫画动效，不要新增剧情。
10. 生成后不会立刻继续制作，用户会先在页面编辑和确认 JSON，所以字段必须清晰、可读、方便人工修改。

【强制漫画风格锁】
无论用户输入的画风是什么，最终图片和视频都必须是“AI 漫剧 / 漫画分镜 / 2D 动漫”方向，不能生成真人、写实电影、3D CG 或游戏过场。
visual_style.global_style_prompt 必须包含以下英文风格锁：${HARD_MANGA_STYLE}。
visual_style.negative_prompt、每个 scene.image_negative_prompt 必须包含以下英文负面词：${HARD_NEGATIVE_STYLE}。
每个 narration_beat.image_prompt、narration_beat.video_prompt、scene.image_prompt 和 scene.video_prompt 都必须显式包含：2D manga comic panel, clean ink line art, anime cel shading, screentone texture, no photorealism, no 3D, no live action。

【强制剧情结构】
1. 0-3 秒：强钩子，必须让观众想继续看。
2. 中段：只保留一条主线，逐步放大压迫、反击、爽点。
3. 结尾：必须有悬念，引导下一集。
如果分镜数量大于 6，不要新增支线、地点和角色；多出的 beat 用来放大同一个动作、表情或情绪，不要跳新剧情。

【强制剧情连续性规则】
不要把 scenes 当成互不相关的插画。每个 beat 必须是上一个 beat 的直接结果。
从 beat_002 开始：
- continuity_from_previous 必须说明上一 beat 的 ending_state 如何自然进入本 beat。
- starting_state 必须继承上一 beat 的 ending_state 中的角色位置、朝向、表情、手势、道具、环境光线。
- 本 beat 只能推进一个小动作或一个剧情信息，不要突然换地点、换时间、换姿势、换情绪。
- 如果必须换地点，必须在前一 beat ending_state 和本 beat starting_state 里设计过渡，例如门、手机画面、车窗、走廊、背影。
- ending_state 必须明确留给下一 beat 继承：角色站位、镜头距离、朝向、表情、手势、关键道具、环境状态。
- visual_continuity_anchor 必须使用英文描述“下一张关键帧生成时要保留上一幕最后一帧的哪些视觉元素”。

【角色一致性规则】
characters 数组只能放“画面中会出现的人物/生物角色”，不要把旁白、叙事者、系统音色、镜头、环境放进 characters。
每个视觉角色必须包含具体的脸、发型、服装、配色、标志物、voice_design_prompt 和 visual_keywords。
visual_keywords 必须使用英文，必须是稳定身份锁定词，不要写临时动作、情绪、剧情事件、受伤状态或光效。
visual_keywords 必须包含：face shape, eye design, eyebrow shape, nose/mouth style, hair silhouette, hair color, bangs, body proportion, outfit layers, outfit colors, signature item, color palette。
后续每个 beat 和 scene 的 image_prompt/video_prompt 必须逐字复用相关角色的 visual_keywords。
每个 characters_in_scene 必须只填写 characters[].name 中已经存在的精确角色名，不能使用别名、代称或泛称。
不能使用已有知名 IP、动漫角色、明星肖像或侵权设定。

【旁白规则】
每个 narration_beat.narration 必须是一句短旁白，中文，适合朗读。
每句旁白建议 8-20 个汉字，最长不要超过 28 个汉字。
不要生成角色对白，不做口型同步；所有对白都改写成第三人称叙述、内心状态或旁白转述。
每个 scene.tts 必须且只能有一项旁白，speaker 必须是“旁白”，type 必须是 narrator。
每个 beat.duration_seconds 必须大于等于 2 且小于等于 6，并且能覆盖该句旁白朗读时长。
所有 beat.duration_seconds 总和必须接近 ${input.durationSeconds} 秒。

【画面和视频规则】
每个 visual_must_show 必须用中文明确写出这一句旁白对应画面必须出现什么。
每个 visual_must_not_show 必须用中文明确写出这一句旁白不能出现什么，防止模型自由发挥。
每个 image_prompt 必须使用英文，直接表现 visual_must_show，不能出现中文对白、字幕、旁白。
每个 video_prompt 必须使用英文，并以 “Start from the supplied manga keyframe...” 开头。
视频只允许轻微漫画动效：limited animation, subtle breathing, one blink, hair and cloth sway, slow parallax camera, speed lines, screentone motion, glowing manga effects。
禁止复杂打斗、奔跑、转身、拥抱、群体动作、大幅手部动作、突然换地点、突然新增角色。
每个 video_prompt 必须要求最后 0.5-1 秒停在 ending_state，方便下一 beat 继续接。

【必须输出以下 JSON 结构】
{
  "project": {
    "title": "",
    "genre": "",
    "style": "旁白驱动 AI 漫剧，2D 漫画分镜，动态漫画",
    "aspect_ratio": "${input.aspectRatio}",
    "language": "zh-CN",
    "duration_seconds": ${input.durationSeconds},
    "scene_count": ${input.sceneCount},
    "target_platform": "短视频平台",
    "summary": ""
  },
  "story": {
    "logline": "",
    "worldview": "",
    "theme": "",
    "main_conflict": "",
    "hook": "",
    "ending_cliffhanger": ""
  },
  "characters": [
    {
      "id": "char_001",
      "name": "",
      "role": "",
      "age": "",
      "gender": "",
      "face": "",
      "hair": "",
      "body": "",
      "outfit": "",
      "colors": [],
      "personality": "",
      "signature_item": "",
      "visual_keywords": "",
      "voice": {
        "voice_type": "dramatic narrator",
        "tone": "",
        "speed": "normal",
        "emotion_range": "",
        "voice_design_prompt": ""
      },
      "speaking_style": ""
    }
  ],
  "visual_style": {
    "global_style_prompt": "${HARD_MANGA_STYLE}",
    "negative_prompt": "${HARD_NEGATIVE_STYLE}",
    "lighting_style": "",
    "camera_style": "",
    "color_palette": [],
    "quality_keywords": []
  },
  "episode": {
    "episode_number": 1,
    "episode_title": "",
    "episode_summary": "",
    "beat_sheet": [
      { "time_range": "0-3s", "purpose": "", "content": "" }
    ]
  },
  "narration_beats": [
    {
      "beat_id": "beat_001",
      "scene_id": "scene_001",
      "order": 1,
      "narration": "",
      "duration_seconds": 4,
      "characters_in_scene": [],
      "visual_must_show": "",
      "visual_must_not_show": "",
      "continuity_from_previous": "opening beat",
      "starting_state": "",
      "ending_state": "",
      "visual_continuity_anchor": "",
      "image_prompt": "",
      "image_negative_prompt": "${HARD_NEGATIVE_STYLE}",
      "video_prompt": "",
      "subtitle_text": ""
    }
  ],
  "scenes": [
    {
      "scene_id": "scene_001",
      "beat_id": "beat_001",
      "time_range": "0-4s",
      "duration_seconds": 4,
      "scene_purpose": "",
      "location": "",
      "characters_in_scene": [],
      "plot": "",
      "visual_description": "",
      "camera": { "shot_type": "medium shot", "angle": "front angle", "movement": "slow push in" },
      "action": "",
      "emotion": "",
      "continuity_from_previous": "opening beat",
      "starting_state": "",
      "ending_state": "",
      "visual_continuity_anchor": "",
      "visual_must_show": "",
      "visual_must_not_show": "",
      "image_prompt": "",
      "image_negative_prompt": "${HARD_NEGATIVE_STYLE}",
      "video_prompt": "",
      "video_motion_strength": "low",
      "tts": [
        {
          "speaker": "旁白",
          "type": "narrator",
          "voiceType": "dramatic storyteller",
          "emotion": "tense",
          "text": "",
          "speed": "normal",
          "volume": "normal",
          "voiceDesignPrompt": "calm but dramatic Chinese short drama narrator, clear rhythm, suspenseful, cinematic, not shouting"
        }
      ],
      "subtitle": [ { "start": 0, "end": 4, "text": "" } ],
      "sound_design": { "sfx": [], "bgm": "", "transition_sound": "" },
      "editing": { "transition": "cut", "pace": "narration-driven", "text_overlay": "", "special_effects": [] }
    }
  ],
  "final_editing_plan": {
    "video_order": [],
    "audio_order": [],
    "subtitle_style": "bold short Chinese subtitle, bottom center, do not cover faces",
    "bgm_plan": "low-volume suspenseful background music under narration",
    "sfx_plan": "only small whoosh, impact and ambience cues that match narration beats",
    "opening_style": "strong hook in first beat",
    "ending_style": "cliffhanger on final beat",
    "export_settings": { "resolution": "1080x1920", "fps": 30, "format": "mp4" }
  },
  "next_episode_teaser": { "title": "", "hook": "", "summary": "" }
}

重要：narration_beats 数组长度必须等于 ${input.sceneCount}，scenes 数组长度也必须等于 ${input.sceneCount}，并且两者必须一一对应。所有 JSON key 必须双引号。不要输出任何 JSON 外的文本。`;
}
