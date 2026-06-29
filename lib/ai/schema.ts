import { z } from "zod";

const DEFAULT_MANGA_STYLE = "2D 日系漫画分镜，干净黑色线稿，赛璐璐上色，网点纸纹，漫画面板构图，强制非写实、非3D、非真人";

export const projectInputSchema = z.object({
  idea: z.string().min(4, "请至少输入 4 个字的短剧主题"),
  genre: z.string().default("热血爽文"),
  style: z.string().default(DEFAULT_MANGA_STYLE),
  durationSeconds: z.coerce.number().min(15).max(180).default(60),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  sceneCount: z.coerce.number().min(3).max(24).default(10),
  voiceMode: z.enum(["built_in", "voice_design"]).default("voice_design"),
  autoRun: z.boolean().default(false)
});
