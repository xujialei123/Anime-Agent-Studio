import { z } from "zod";

export const DEFAULT_DIRECTOR_PROMPT = [
  "旁白驱动 AI 漫剧：一句旁白对应一个画面 beat，一个 beat 只推进一个信息点。",
  "生成内容必须先让用户确认剧本、分镜、旁白和 Prompt，再继续生成图片。",
  "图片生成后也必须让用户确认，确认后才继续生成视频。",
  "固定系统规则只作为默认模板，用户可以在创建页覆盖和补充自己的创作要求。",
  "画风保持 2D 日系漫画分镜、干净黑色线稿、赛璐璐上色、网点纸纹，强制非写实、非3D、非真人。"
].join("\n");

const DEFAULT_MANGA_STYLE = "2D 日系漫画分镜，干净黑色线稿，赛璐璐上色，网点纸纹，漫画面板构图，强制非写实、非3D、非真人";

export const projectInputSchema = z.object({
  idea: z.string().min(4, "请至少输入 4 个字的短剧主题"),
  genre: z.string().default("热血爽文"),
  style: z.string().default(DEFAULT_MANGA_STYLE),
  durationSeconds: z.coerce.number().min(15).max(180).default(30),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  sceneCount: z.coerce.number().min(3).max(24).default(6),
  voiceMode: z.enum(["built_in", "voice_design"]).default("voice_design"),
  autoRun: z.boolean().default(false),
  directorPrompt: z.string().default(DEFAULT_DIRECTOR_PROMPT)
});
