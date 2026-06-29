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
```

## 使用流程

1. 进入 `/create`
2. 输入短剧主题
3. 点击“创建 Agent 任务”
4. 进入 `/studio/[projectId]`
5. 先执行 `story.generate`
6. 继续执行图片、视频、配音任务
7. 最终接入 `/api/render/merge` 或独立 Worker 合成

## 连贯性生成流程

当前版本把“角色一致”和“剧情连续”拆成两个层面处理：

1. 先生成角色定稿图，作为人物身份参考。
2. 每个分镜生成自己的漫画关键帧。
3. scene_002 之后的关键帧会等待上一段视频生成完成。
4. 系统会抽取上一段视频最后一帧，作为下一幕关键帧的连续性参考。
5. 下一幕关键帧生成时会同时参考：上一幕最后一帧 + 当前出场角色定稿图 + 当前剧情 starting_state。
6. 每段视频都要求最后停在 ending_state，方便下一幕继续接。

故事 JSON 里的每个 scene 建议包含：

- `continuity_from_previous`：上一幕如何自然进入本幕。
- `starting_state`：本幕第一帧继承的角色位置、朝向、表情、道具和环境状态。
- `ending_state`：本幕最后一帧留给下一幕继承的状态。
- `visual_continuity_anchor`：下一张关键帧生成时要保留上一幕最后一帧的哪些视觉元素。

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
