"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, CheckCircle2, CircleDashed, ImageIcon, Loader2, Mic2, Play, RefreshCw, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AgentTask, StoredProject } from "@/lib/ai/types";

function StatusIcon({ status }: { status: AgentTask["status"] }) {
  if (status === "succeeded") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-300" />;
  if (status === "running" || status === "generating") return <Loader2 className="h-4 w-4 animate-spin text-studio-cyan" />;
  return <CircleDashed className="h-4 w-4 text-studio-muted" />;
}

function statusLabel(status: AgentTask["status"]) {
  if (status === "succeeded") return "已完成";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  if (status === "generating") return "生成中";
  if (status === "skipped") return "已跳过";
  return "等待中";
}

function taskIcon(type: string) {
  if (type.includes("image")) return <ImageIcon className="h-4 w-4" />;
  if (type.includes("video")) return <Video className="h-4 w-4" />;
  if (type.includes("tts")) return <Mic2 className="h-4 w-4" />;
  return <Bot className="h-4 w-4" />;
}

export default function StudioPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [project, setProject] = useState<StoredProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeScene, setActiveScene] = useState(0);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (projectId === "demo") return;
    if (loadPromiseRef.current) return loadPromiseRef.current;

    const promise = (async () => {
      const res = await fetch(`/api/tasks/status?projectId=${projectId}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setProject(data.project);
    })().finally(() => {
      loadPromiseRef.current = null;
    });

    loadPromiseRef.current = promise;
    return promise;
  }, [projectId]);

  async function run(taskId?: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskId ? { taskId } : { projectId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "执行失败");
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      await load().catch(() => undefined);
      if (!cancelled) timer = setTimeout(loop, 5000);
    };

    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  const scenes = project?.plan?.scenes || [];
  const currentScene = scenes[activeScene];
  const progress = useMemo(() => {
    if (!project?.tasks.length) return 0;
    return Math.round((project.tasks.filter((task) => task.status === "succeeded").length / project.tasks.length) * 100);
  }, [project]);

  if (projectId === "demo") {
    return <DemoStudio />;
  }

  return (
    <main className="min-h-screen px-4 py-4">
      <div className="grid h-[calc(100vh-32px)] gap-4 lg:grid-cols-[300px_1fr_380px]">
        <aside className="glass-card flex min-h-0 flex-col rounded-3xl p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-studio-muted">Project</p>
              <h1 className="line-clamp-2 text-lg font-black">{project?.plan?.project.title || "动漫短剧项目"}</h1>
            </div>
            <Button variant="ghost" className="px-3" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex justify-between text-xs text-studio-muted">
              <span>任务进度</span><span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-gradient-to-r from-studio-purple to-studio-cyan" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {project?.finalVideoUrl ? (
            <a
              href={project.finalVideoUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15"
            >
              <Video className="h-4 w-4" />
              查看最终成片
            </a>
          ) : null}

          <Button onClick={() => run()} disabled={loading || !project} className="mb-4 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            执行可运行任务
          </Button>

          <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-auto pr-1">
            {project?.tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => run(task.id)}
                disabled={loading || task.status === "running" || task.status === "generating" || task.status === "succeeded"}
                className={`w-full rounded-2xl border p-3 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70 ${
                  task.status === "running" || task.status === "generating"
                    ? "border-studio-cyan/50 bg-studio-cyan/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-studio-muted">{taskIcon(task.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold">{task.title}</p>
                      <StatusIcon status={task.status} />
                    </div>
                    <p className="mt-1 text-xs text-studio-muted">{task.agent} · {task.type} · {statusLabel(task.status)}</p>
                    {task.error ? <p className="mt-2 line-clamp-2 text-xs text-red-300">{task.error}</p> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="glass-card flex min-h-0 flex-col rounded-3xl p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-studio-muted">Preview</p>
              <h2 className="text-xl font-black">{currentScene?.scene_id || "等待生成分镜"}</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-studio-muted">
              {project?.input.aspectRatio || "9:16"}
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,420px)_1fr]">
            <div className="mx-auto aspect-[9/16] h-full max-h-[680px] w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/10 bg-black/40">
              {currentScene?.video_url ? (
                <video className="h-full w-full object-cover" src={currentScene.video_url} controls />
              ) : currentScene?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentScene.image_url} alt="scene" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-studio-muted">
                  <ImageIcon className="mb-4 h-10 w-10" />
                  <p>执行 story.generate 后会出现分镜，执行 scene.image.generate 后会出现关键帧。</p>
                </div>
              )}
            </div>

            <div className="scrollbar-thin min-h-0 overflow-auto rounded-3xl border border-white/10 bg-black/25 p-5">
              <h3 className="font-bold">剧情信息</h3>
              <p className="mt-3 text-sm leading-7 text-studio-muted">{currentScene?.plot || project?.plan?.story.logline || "暂无剧情。"}</p>

              <h3 className="mt-6 font-bold">Image Prompt</h3>
              <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-studio-muted">{currentScene?.image_prompt || "暂无"}</pre>

              <h3 className="mt-6 font-bold">Video Prompt</h3>
              <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-studio-muted">{currentScene?.video_prompt || "暂无"}</pre>
            </div>
          </div>

          <div className="scrollbar-thin mt-4 flex gap-3 overflow-x-auto pb-1">
            {scenes.map((scene, index) => (
              <button
                key={scene.scene_id}
                onClick={() => setActiveScene(index)}
                className={`min-w-36 rounded-2xl border p-3 text-left ${activeScene === index ? "border-studio-cyan bg-studio-cyan/10" : "border-white/10 bg-white/5"}`}
              >
                <p className="text-xs text-studio-muted">{scene.time_range}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold">{scene.scene_purpose}</p>
              </button>
            ))}
          </div>
        </section>

        <aside className="glass-card min-h-0 overflow-auto rounded-3xl p-4 scrollbar-thin">
          <p className="text-xs text-studio-muted">Agents</p>
          <h2 className="mt-1 text-xl font-black">AI 任务协议</h2>
          <div className="mt-4 space-y-3">
            {[
              ["story_director", "生成故事 JSON、角色和分镜"],
              ["character_designer", "锁定角色形象和角色图"],
              ["image_operator", "调用 Agnes 生成图片"],
              ["video_operator", "调用 Agnes 生成视频"],
              ["voice_director", "调用 MiMo 生成配音"],
              ["render_engineer", "合成字幕音频视频"]
            ].map(([name, desc]) => (
              <Card key={name} className="p-4">
                <p className="font-mono text-xs text-studio-cyan">{name}</p>
                <p className="mt-2 text-sm text-studio-muted">{desc}</p>
              </Card>
            ))}
          </div>

          <h3 className="mt-6 font-bold">角色</h3>
          <div className="mt-3 space-y-3">
            {project?.plan?.characters.map((char) => (
              <Card key={char.id} className="p-4">
                <p className="font-bold">{char.name}</p>
                <p className="mt-1 text-xs text-studio-muted">{char.role}</p>
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-studio-muted">{char.visual_keywords}</p>
              </Card>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

function DemoStudio() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-2xl p-8 text-center">
        <h1 className="text-3xl font-black">Studio 布局已就绪</h1>
        <p className="mt-4 text-studio-muted">请从 /create 创建真实项目，然后进入 Studio 执行任务。Demo 页面只是为了展示入口。</p>
      </Card>
    </main>
  );
}
