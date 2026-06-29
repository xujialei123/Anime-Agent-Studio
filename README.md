# Anime Agent Studio

一个基于 Next.js 的 AI 动漫短剧生成网站骨架，已内置：

- 现代化暗色创作工作台 UI
- Agent 规则：编剧、角色一致性、图片、视频、配音、后期合成
- Task DAG：任务依赖、状态流转、可单独执行/整体执行
- Agnes 封装：Chat / Image / Video / Video Status
- MiMo 封装：TTS / Voice Design
- API Routes：故事生成、图片生成、视频生成、配音生成、任务创建、任务执行、任务状态
- ffmpeg 合成接口示例

## 运行

```bash
cp .env.example .env.local
npm install
npm run dev
```

打开：

```bash
http://localhost:3000
```

## 环境变量

```env
AGNES_API_KEY=你的_agnes_key
AGNES_BASE_URL=https://apihub.agnes-ai.com/v1
AGNES_CHAT_MODEL=agnes-2.0-flash
AGNES_IMAGE_MODEL=agnes-image-2.1-flash
AGNES_IMAGE_REFERENCE_MODEL=agnes-image-2.0-flash
AGNES_VIDEO_MODEL=agnes-video-v2.0

MIMO_API_KEY=你的_mimo_key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_TTS_MODEL=mimo-v2.5-tts
MIMO_TTS_VOICE_DESIGN_MODEL=mimo-v2.5-tts-voicedesign

FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

## 使用流程

1. 进入 `/create`
2. 输入短剧主题
3. 推荐先使用 `30 秒 / 6 个 beat`
4. 点击“创建 Agent 任务”
5. 进入 `/studio/[projectId]`
6. 先执行 `story.generate`
7. 继续执行角色图、beat 关键帧、beat 视频、beat 旁白任务
8. 最终由 `project.merge` 或 `/api/render/merge` 合成

## 旁白 Beat 驱动流程

为了解决“剧情不连贯、画面和旁白不匹配”，当前版本采用旁白驱动：

```txt
一句旁白 = 一个 narration beat = 一个漫画关键帧 = 一个轻量视频片段 = 一个合成片段
```

生成链路：

```txt
Story Director
  ↓
生成 narration_beats
  ↓
每个 beat 生成对应 scene
  ↓
角色定稿图
  ↓
每个 beat 的漫画关键帧
  ↓
每个 beat 的轻量漫画动效
  ↓
每个 beat 的旁白 TTS
  ↓
按真实旁白音频时长合成
```

`narration_beats` 和 `scenes` 必须一一对应：

```txt
narration_beats[0] ↔ scenes[0]
narration_beats[1] ↔ scenes[1]
...
```

每个 beat 包含：

- `narration`：这一句旁白。
- `visual_must_show`：画面必须表现什么。
- `visual_must_not_show`：画面不能出现什么，防止跑偏。
- `starting_state`：本 beat 起始状态。
- `ending_state`：本 beat 结束状态。
- `continuity_from_previous`：从上一 beat 怎么接过来。
- `image_prompt`：只生成这一句旁白对应漫画关键帧。
- `video_prompt`：只做轻微漫画动效，不让视频模型自由演剧情。

## 合成策略

合成层不再默认使用淡入淡出转场。旁白驱动模式默认硬切，避免 `xfade/acrossfade` 吃掉每句旁白的头尾，导致画面和声音错位。

如果传入 `audioUrl`，合成器会尝试用 `ffprobe` 读取真实音频时长，并让视频片段服从旁白音频时长，而不是固定 5 秒。

外部调用 `/api/render/merge` 时也可以传：

```json
{
  "scenes": [
    {
      "videoUrl": "https://.../beat-001.mp4",
      "audioUrl": "https://.../beat-001.wav",
      "duration": 4,
      "audioDuration": 3.6
    }
  ],
  "aspectRatio": "9:16",
  "transitionDuration": 0
}
```

## 目录说明

```txt
app/
  api/
    story/generate       直接生成短剧 JSON
    image/generate       Agnes 图片生成
    video/generate       Agnes 视频任务创建
    video/status         Agnes 视频状态查询
    tts/generate         MiMo TTS
    tasks/create         创建项目和初始 story task
    tasks/run            执行单个任务或项目可运行任务
    tasks/status         查询项目/任务状态
    render/merge         ffmpeg 合成示例
  create/                创建页面
  studio/[projectId]/    创作工作台

lib/
  ai/agents.ts           Agent 规则
  ai/prompts/            总导演 Prompt
  providers/agnes.ts     Agnes API 封装
  providers/mimo.ts      MiMo API 封装
  render/media-composer.ts 合成器
  tasks/factory.ts       任务生成
  tasks/runner.ts        任务执行器
  store/memory.ts        Demo 内存存储
```

## 注意

当前版本是 Demo 骨架，`projectStore` 使用内存保存，刷新服务后数据会丢。生产环境请把 `lib/store/memory.ts` 换成 Supabase/PostgreSQL，并把长任务放进 BullMQ/Redis Worker。

Agnes 和 MiMo 的响应字段可能会随官方更新略有变化，如果接口返回结构不同，主要改两个文件：

- `lib/providers/agnes.ts`
- `lib/providers/mimo.ts`

## 本地测试 Agnes / MiMo Key

配置 `.env.local` 后执行：

```bash
npm run check:apis
```

脚本会测试 Agnes 文本、Agnes 图片、MiMo TTS，并把 MiMo 测试音频保存到 `tmp/mimo-tts-test.wav`。
