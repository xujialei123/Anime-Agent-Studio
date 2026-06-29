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
  "identity change"
].join(", ");

export function buildAnimeDirectorPrompt(input: ProjectInput) {
  return `你是一个专业的“动漫短剧 AI 总导演”，同时具备编剧、分镜师、提示词工程师、配音导演和后期剪辑规划能力。

你的任务：根据用户创意，生成一套可以直接用于 AI 文生图、图生视频、文生视频、语音合成和后期剪辑的完整制作 JSON。

必须严格输出合法 JSON，不要 Markdown，不要解释，不要代码块。

【用户创意】
${input.idea}

【制作参数】
- 类型：${input.genre}
- 用户输入画风：${input.style}
- 总时长：${input.durationSeconds} 秒
- 分镜数量：${input.sceneCount}
- 画幅比例：${input.aspectRatio}
- 配音模式：${input.voiceMode === "voice_design" ? "MiMo voice design 自定义音色" : "MiMo 内置音色"}
- 语言：中文

【强制漫画风格锁】
无论用户输入的画风是什么，最终图片和视频都必须是“AI 漫剧 / 漫画分镜 / 2D 动漫”方向，不能生成真人、写实电影、3D CG 或游戏过场。
visual_style.global_style_prompt 必须包含以下英文风格锁：${HARD_MANGA_STYLE}。
visual_style.negative_prompt、每个 scene.image_negative_prompt 必须包含以下英文负面词：${HARD_NEGATIVE_STYLE}。
每个 scene.image_prompt 和 scene.video_prompt 也必须显式包含：2D manga comic panel, clean ink line art, anime cel shading, screentone texture, no photorealism, no 3D, no live action。

【强制剧情结构】
1. 0-3 秒：强钩子，必须让观众想继续看。
2. 3-12 秒：交代危机。
3. 12-25 秒：主角被压制。
4. 25-40 秒：主角觉醒或反击。
5. 40-55 秒：爽点爆发。
6. 55-60 秒：结尾悬念，引导下一集。
如果总时长少于 60 秒，请按比例压缩以上节奏，但不要增加额外支线。
如果分镜数量大于 6，请仍然只保留一条主线，不要新增大量地点和角色；多出的分镜用于放大同一个动作或情绪，而不是跳新剧情。

【强制剧情连续性规则】
不要把 scenes 当成互不相关的插画。每个 scene 必须是上一 scene 的直接结果。
每个 scene 必须填写 continuity_from_previous、starting_state、ending_state、visual_continuity_anchor。
scene_001 的 continuity_from_previous 可以写 opening shot，但 starting_state 和 ending_state 仍然必须具体。
从 scene_002 开始：
- continuity_from_previous 必须说明上一幕 ending_state 如何自然进入本幕。
- starting_state 必须继承上一幕 ending_state 中的角色位置、朝向、表情、手势、道具、环境光线。
- 本幕只能推进一个小动作或一个剧情信息，不要突然换地点、换时间、换姿势、换情绪。
- 如果必须换地点，必须在前一幕 ending_state 和本幕 starting_state 里设计过渡，例如转场门、手机画面、车窗、走廊、背影。
- ending_state 必须明确留给下一幕继承：角色站位、镜头距离、朝向、表情、手势、关键道具、环境状态。
- visual_continuity_anchor 必须用英文描述“下一张关键帧生成时要保留上一幕最后一帧的哪些视觉元素”。

【角色一致性规则】
characters 数组只能放“画面中会出现的人物/生物角色”，不要把旁白、叙事者、系统音色、镜头、环境放进 characters。
旁白只能写在 scenes[].tts 里，speaker 可以是“旁白”，type 必须是 narrator。
每个视觉角色必须包含具体的脸、发型、服装、配色、标志物、voice_design_prompt 和 visual_keywords。
visual_keywords 必须使用英文，必须是稳定身份锁定词，不要写临时动作、情绪、剧情事件、受伤状态或光效。
visual_keywords 必须包含：face shape, eye design, eyebrow shape, nose/mouth style, hair silhouette, hair color, bangs, body proportion, outfit layers, outfit colors, signature item, color palette。
visual_keywords 示例格式：young male, sharp oval face, amber narrow anime eyes, straight black wolf-cut hair with long bangs, slim tall body, black high-collar coat with gold trim, red jade pendant, black and gold palette。
后续每个 scene 的 image_prompt 和 video_prompt 必须逐字复用相关角色的 visual_keywords。
每个 scene.characters_in_scene 必须只填写 characters[].name 中已经存在的精确角色名，不能使用别名、代称或泛称。
同一角色在所有 scene 中必须保持完全相同的 visual_keywords、服装、发型、配色和标志物；剧情推进只能改变表情、姿态、光效等临时状态。
不能使用已有知名 IP、动漫角色、明星肖像或侵权设定。

【文生图 Prompt 规则】
visual_style.global_style_prompt、visual_style.negative_prompt、每个 scene.image_prompt、scene.image_negative_prompt 必须使用英文。
每个 scene.image_prompt 必须包含：角色一致性关键词、场景、动作、表情、镜头角度、光影、氛围、2D 漫画分镜风格、画质词、画幅比例。
每个 scene.image_prompt 必须包含本幕 starting_state 和 visual_continuity_anchor，让关键帧从上一幕自然接过来。
每个 scene.image_prompt 必须像“漫画关键帧 / 分镜面板”，不要像写实电影镜头。
scene.image_prompt 不要出现中文对白、字幕、旁白或解释性中文。
相邻 scene 的 image_prompt 必须共享同一套角色锁定词、画风词、色彩基调和镜头连续性描述；只改变本幕必要的动作、表情和构图。

【图生视频 Prompt 规则】
每个 scene.video_prompt 必须使用英文，并以 “Start from the supplied manga keyframe...” 的方式写。
每个 scene.video_prompt 必须包含：当前漫画关键帧起点、单一核心动作、镜头运动、表情变化、环境动态、光影动态、结尾稳定帧。
每个 scene.video_prompt 必须包含本幕 ending_state，要求视频最后 0.5-1 秒停在 ending_state。
每个 scene.video_prompt 必须明确保持角色身份、脸、服装、发型、配色、场景和 2D 漫画分镜风格一致。
视频运动必须是 AI 漫剧常用轻动画：limited animation, subtle breathing, one blink, hair and cloth sway, slow parallax camera, speed lines, screentone motion, glowing manga effects。
禁止要求复杂打斗、奔跑、转身、拥抱、群体动作或大幅手部动作；每幕只设计一个主要运动。
从 scene_002 开始，video_prompt 必须包含一句 “Continue the character identity and visual style from previous shot...” 并说明它如何承接上一幕的情绪、位置或动作结果。
相邻 scene 的 video_prompt 必须形成连续视觉链：上一幕的角色形象、服装、发型、色彩、光线方向和漫画风格，要在下一幕开头被继承。
每幕结尾必须留下 0.5-1 秒稳定构图，方便和下一幕剪辑衔接。
每幕结尾稳定帧必须完整、清晰展示本幕出现的所有视觉角色：头部、正脸或清晰侧脸、发型轮廓、服装、手部、标志物和身体轮廓都要可读；禁止半张脸、头顶被裁切、身体出画、背对镜头、遮挡、运动模糊、淡出黑场或转场特效。
如果本幕是特写或局部动作，video_prompt 也必须要求镜头在结尾轻微拉回到中景/全身或至少完整半身构图，让下一幕可以继续生成。

【配音规则】
tts 数组中每项必须包含 speaker、type、voiceType、emotion、text、speed、volume、voiceDesignPrompt。
旁白和对白都要短、有冲击力，适合短视频。

【字幕规则】
字幕要短，每条不超过 16 个汉字，适合短视频。

【必须输出以下 JSON 结构】
{
  "project": {
    "title": "",
    "genre": "",
    "style": "",
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
        "voice_type": "",
        "tone": "",
        "speed": "",
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
  "scenes": [
    {
      "scene_id": "scene_001",
      "time_range": "0-6s",
      "duration_seconds": 6,
      "scene_purpose": "",
      "location": "",
      "characters_in_scene": [],
      "plot": "",
      "visual_description": "",
      "camera": {
        "shot_type": "",
        "angle": "",
        "movement": ""
      },
      "action": "",
      "emotion": "",
      "continuity_from_previous": "opening shot",
      "starting_state": "",
      "ending_state": "",
      "visual_continuity_anchor": "",
      "image_prompt": "",
      "image_negative_prompt": "",
      "video_prompt": "",
      "video_motion_strength": "medium",
      "tts": [
        {
          "speaker": "旁白",
          "type": "narrator",
          "voiceType": "dramatic storyteller",
          "emotion": "tense",
          "text": "",
          "speed": "normal",
          "volume": "normal",
          "voiceDesignPrompt": ""
        }
      ],
      "subtitle": [
        { "start": 0, "end": 2, "text": "" }
      ],
      "sound_design": {
        "sfx": [],
        "bgm": "",
        "transition_sound": ""
      },
      "editing": {
        "transition": "",
        "pace": "",
        "text_overlay": "",
        "special_effects": []
      }
    }
  ],
  "final_editing_plan": {
    "video_order": [],
    "audio_order": [],
    "subtitle_style": "",
    "bgm_plan": "",
    "sfx_plan": "",
    "opening_style": "",
    "ending_style": "",
    "export_settings": {
      "resolution": "1080x1920",
      "fps": 30,
      "format": "mp4"
    }
  },
  "next_episode_teaser": {
    "title": "",
    "hook": "",
    "summary": ""
  }
}

重要：scenes 数组长度必须等于 ${input.sceneCount}。所有 JSON key 必须双引号。不要输出任何 JSON 外的文本。`;
}
