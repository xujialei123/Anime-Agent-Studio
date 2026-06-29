# AI Task Protocol

这个项目把“生成动漫短剧”拆成 Agent + Task DAG，方便后续接数据库、队列、Worker、Webhook。

## Agents

| Agent | 作用 | 主要输出 |
|---|---|---|
| story_director | 生成完整短剧 JSON | project / story / characters / scenes |
| character_designer | 锁定角色一致性 | visual_keywords / character image prompt |
| scene_prompt_engineer | 优化图片和视频提示词 | image_prompt / video_prompt |
| image_operator | 调 Agnes 图片 API | image_url |
| video_operator | 调 Agnes 视频 API | task_id / video_url |
| voice_director | 调 MiMo TTS API | audio base64 / audio url |
| render_engineer | 合成最终短剧 | final_video_url |

## Task 状态

```ts
type TaskStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";
```

## Task 依赖规则

- `story.generate` 无依赖，必须最先执行。
- `character.image.generate` 依赖 story 输出的 characters。
- `scene.image.generate` 依赖 story 输出的 scenes。
- `scene.video.generate` 依赖对应的 `scene.image.generate`，优先走图生视频。
- `scene.tts.generate` 依赖 story 输出的 scene.tts。
- `project.merge` 依赖所有 video/tts 任务。

## 生产环境建议

当前 Demo 使用内存 Store，适合跑通流程。生产建议替换为：

- 数据库：Supabase/PostgreSQL
- 队列：BullMQ + Redis
- 存储：Cloudflare R2 / Supabase Storage
- 合成：独立 Node Worker 或 Python Worker
- 视频状态：Webhook 或定时轮询

## 推荐表结构

```sql
projects(id, user_id, title, input_json, plan_json, status, final_video_url, created_at, updated_at)
characters(id, project_id, name, visual_keywords, image_url, voice_json)
scenes(id, project_id, scene_id, index, image_prompt, video_prompt, image_url, video_url, audio_url, status)
generation_tasks(id, project_id, scene_id, type, agent, status, depends_on, input_json, output_json, error, created_at, updated_at)
assets(id, project_id, type, url, meta_json, created_at)
```
