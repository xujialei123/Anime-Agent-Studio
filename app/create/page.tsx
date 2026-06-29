"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";

const MANGA_STYLE_PRESET = "2D 日系漫画分镜，干净黑色线稿，赛璐璐上色，网点纸纹，漫画面板构图，强制非写实、非3D、非真人，旁白驱动动态漫画";

const DEFAULT_DIRECTOR_PROMPT = [
  "旁白驱动 AI 漫剧：一句旁白对应一个画面 beat，一个 beat 只推进一个信息点。",
  "生成内容必须先让用户确认剧本、分镜、旁白和 Prompt，再继续生成图片。",
  "图片生成后也必须让用户确认，确认后才继续生成视频。",
  "固定系统规则只作为默认模板，用户可以在创建页覆盖和补充自己的创作要求。",
  "画风保持 2D 日系漫画分镜、干净黑色线稿、赛璐璐上色、网点纸纹，强制非写实、非3D、非真人。"
].join("\n");

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    idea: "生成一个男主被家族背叛，三年后觉醒龙魂归来复仇的动漫短剧，风格要热血、爽、反转多。",
    genre: "热血爽文",
    style: MANGA_STYLE_PRESET,
    durationSeconds: 30,
    sceneCount: 6,
    aspectRatio: "9:16",
    voiceMode: "voice_design",
    autoRun: false,
    directorPrompt: DEFAULT_DIRECTOR_PROMPT
  });

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      router.push(`/studio/${data.project.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm text-studio-muted">Create</p>
          <h1 className="mt-2 text-4xl font-black">创建动漫短剧</h1>
          <p className="mt-3 text-studio-muted">默认 Prompt 只是模板，你可以直接改成自己的创作要求。</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="p-6">
            <label className="text-sm font-semibold">短剧主题</label>
            <Textarea
              value={form.idea}
              onChange={(e) => setForm({ ...form, idea: e.target.value })}
              className="mt-3 min-h-44 text-base leading-7"
              placeholder="例如：生成一个废柴少年被宗门抛弃，三年后觉醒龙魂归来复仇的动漫短剧。"
            />

            <label className="mt-6 block text-sm font-semibold">总导演 Prompt</label>
            <Textarea
              value={form.directorPrompt}
              onChange={(e) => setForm({ ...form, directorPrompt: e.target.value })}
              className="mt-3 min-h-52 text-sm leading-6"
              placeholder={DEFAULT_DIRECTOR_PROMPT}
            />
            <p className="mt-2 text-xs text-studio-muted">这里可以完全改写。默认内容只作为模板，会和主题、时长、beat 数一起传给总导演 Agent。</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold">类型</label>
                <Select className="mt-2" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
                  <option>热血爽文</option>
                  <option>都市逆袭</option>
                  <option>玄幻修仙</option>
                  <option>悬疑反转</option>
                  <option>搞笑沙雕</option>
                  <option>恋爱甜宠</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold">画风</label>
                <Input
                  className="mt-2"
                  value={form.style}
                  onChange={(e) => setForm({ ...form, style: e.target.value })}
                  placeholder={MANGA_STYLE_PRESET}
                />
                <p className="mt-2 text-xs text-studio-muted">建议保留“非写实、非3D、非真人”，否则视频模型容易跑成电影感真人画面。</p>
              </div>
              <div>
                <label className="text-sm font-semibold">时长</label>
                <Select className="mt-2" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })}>
                  <option value={15}>15 秒</option>
                  <option value={30}>30 秒</option>
                  <option value={60}>60 秒</option>
                  <option value={90}>90 秒</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold">旁白 Beat 数</label>
                <Select className="mt-2" value={form.sceneCount} onChange={(e) => setForm({ ...form, sceneCount: Number(e.target.value) })}>
                  <option value={3}>3 个 beat</option>
                  <option value={6}>6 个 beat</option>
                  <option value={10}>10 个 beat</option>
                  <option value={15}>15 个 beat</option>
                </Select>
                <p className="mt-2 text-xs text-studio-muted">推荐先用 30 秒 / 6 个 beat：一句旁白对应一个画面，更容易和视频匹配。</p>
              </div>
              <div>
                <label className="text-sm font-semibold">画幅</label>
                <Select className="mt-2" value={form.aspectRatio} onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })}>
                  <option>9:16</option>
                  <option>16:9</option>
                  <option>1:1</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold">配音模式</label>
                <Select className="mt-2" value={form.voiceMode} onChange={(e) => setForm({ ...form, voiceMode: e.target.value })}>
                  <option value="voice_design">MiMo 自定义音色</option>
                  <option value="built_in">MiMo 内置音色</option>
                </Select>
              </div>
            </div>

            <Button onClick={submit} disabled={loading} className="mt-8 w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              创建 Agent 任务
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold">确认式流程</h2>
            <div className="mt-5 space-y-4">
              {[
                "自己编辑总导演 Prompt",
                "生成可编辑剧本和旁白 beat",
                "手动修改 JSON / 分镜 Prompt / 旁白",
                "确认剧本后才生成图片和配音",
                "查看图片，不满意就改 Prompt 后重来",
                "确认图片后才生成视频",
                "全部确认后再合成最终成片"
              ].map((item, index) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">{index + 1}</div>
                  <p className="text-sm text-studio-muted">{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
