"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, CheckCircle2, CircleDashed, Edit3, ImageIcon, Loader2, Mic2, Play, RefreshCw, Save, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AgentTask, AnimeScene, StoredProject } from "@/lib/ai/types";

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

function sceneNarration(scene?: AnimeScene) {
  return scene?.tts?.map((item) => item.text).filter(Boolean).join("，") || "";
}

export default function StudioPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [project, setProject] = useState<StoredProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeScene, setActiveScene] = useState(0);
  const [planJson, setPlanJson] = useState("");
  const [sceneDraft, setSceneDraft] = useState<Partial<AnimeScene>>({});
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

  async function review(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch("/api/projects/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action, ...extra })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      if (data.project) setProject(data.project);
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  function parsePlanJson() {
    if (!planJson.trim()) throw new Error("剧本 JSON 为空");
    return JSON.parse(planJson);
  }

  async function savePlanJson() {
    try {
      await review("update_plan", { plan: parsePlanJson() });
      alert("已保存剧本 JSON。再次修改后需要重新确认剧本。 ");
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  async function approvePlan() {
    try {
      await review("approve_plan", { plan: parsePlanJson() });
      alert("已确认剧本。现在可以生成角色图、图片和配音。 ");
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveSceneDraft() {
    const current = project?.plan?.scenes[activeScene];
    if (!current) return;
    const nextScene: Partial<AnimeScene> = {
      ...sceneDraft,
      scene_id: current.scene_id,
      tts: [
        {
          ...(current.tts?.[0] || {
            speaker: "旁白",
            type: "narrator" as const,
            voiceType: "dramatic storyteller",
            emotion: "tense",
            text: "",
            speed: "normal" as const,
            volume: "normal" as const
          }),
          text: String(sceneDraft.tts?.[0]?.text || sceneNarration(current))
        }
      ]
    };
    await review("update_scene", { sceneId: current.scene_id, scene: nextScene });
    alert("已保存当前分镜修改。 ");
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

  useEffect(() => {
    if (project?.plan) setPlanJson(JSON.stringify(project.plan, null, 2));
  }, [project?.plan]);

  const scenes = project?.plan?.scenes || [];
  const currentScene = scenes[activeScene];

  useEffect(() => {
    if (!currentScene) {
      setSceneDraft({});
      return;
    }
    setSceneDraft({
      plot: currentScene.plot,
      visual_must_show: currentScene.visual_must_show,
      visual_must_not_show: currentScene.visual_must_not_show,
      image_prompt: currentScene.image_prompt,
      image_negative_prompt: currentScene.image_negative_prompt,
      video_prompt: currentScene.video_prompt,
      tts: currentScene.tts,
      subtitle: currentScene.subtitle
    });
  }, [currentScene?.scene_id]);

  const progress = useMemo(() => {
    if (!project?.tasks.length) return 0;
    return Math.round((project.tasks.filter((task) => task.status === "succeeded").length / project.tasks.length) * 100);
  }, [project]);
  const planApproved = Boolean(project?.planApprovedAt);
  const allImagesApproved = Boolean(scenes.length) && scenes.every((scene) => scene.image_url && scene.image_approved);

  if (projectId === "demo") {
    return <DemoStudio />;
  }

  return (
    <main className="min-h-screen px-4 py-4">
      <div className="grid h-[calc(100vh-32px)] gap-4 lg:grid-cols-[300px_1fr_420px]">
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
            <p className="mt-3 text-xs text-studio-muted">{planApproved ? "剧本已确认，可以生成图片/配音。" : "请先生成并确认剧本，再继续创作。"}</p>
          </div>

          {project?.finalVideoUrl ? (
            <a href={project.finalVideoUrl} target="_blank" rel="noreferrer" className="mb-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15">
              <Video className="h-4 w-4" />
              查看最终成片
            </a>
          ) : null}

          <Button onClick={() => run()} disabled={loading || !project} className="mb-3 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {planApproved ? "执行可运行任务" : "生成/刷新剧本"}
          </Button>

          {project?.plan ? (
            <Button onClick={approvePlan} disabled={loading} variant="secondary" className="mb-4 gap-2">
              <CheckCircle2 className="h-4 w-4" />
              确认使用当前剧本
            </Button>
          ) : null}

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
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-studio-muted">Preview</p>
              <h2 className="text-xl font-black">{currentScene?.scene_id || "等待生成分镜"}</h2>
            </div>
            <div className="flex gap-2">
              {currentScene?.image_url ? (
                <Button variant={currentScene.image_approved ? "secondary" : "default"} disabled={loading || currentScene.image_approved} onClick={() => review("approve_image", { sceneId: currentScene.scene_id })} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {currentScene.image_approved ? "图片已确认" : "确认图片生成视频"}
                </Button>
              ) : null}
              {allImagesApproved ? <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">全部图片已确认</span> : null}
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
                  <p>先确认剧本，再执行图片任务。图片满意后点击确认，才会创建视频任务。</p>
                </div>
              )}
            </div>

            <div className="scrollbar-thin min-h-0 overflow-auto rounded-3xl border border-white/10 bg-black/25 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold">当前分镜可编辑内容</h3>
                <Button size="sm" variant="secondary" onClick={saveSceneDraft} disabled={!currentScene || loading} className="gap-2"><Save className="h-4 w-4" />保存分镜</Button>
              </div>

              <label className="mt-4 block text-xs text-studio-muted">旁白</label>
              <textarea className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-6 outline-none focus:border-studio-cyan" value={sceneDraft.tts?.[0]?.text || ""} onChange={(e) => setSceneDraft({ ...sceneDraft, tts: [{ ...(sceneDraft.tts?.[0] || currentScene?.tts?.[0]), text: e.target.value } as AnimeScene["tts"][number]] })} />

              <label className="mt-4 block text-xs text-studio-muted">剧情 / 画面必须出现</label>
              <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-6 outline-none focus:border-studio-cyan" value={sceneDraft.visual_must_show || sceneDraft.plot || ""} onChange={(e) => setSceneDraft({ ...sceneDraft, visual_must_show: e.target.value, plot: e.target.value })} />

              <label className="mt-4 block text-xs text-studio-muted">Image Prompt</label>
              <textarea className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-6 outline-none focus:border-studio-cyan" value={sceneDraft.image_prompt || ""} onChange={(e) => setSceneDraft({ ...sceneDraft, image_prompt: e.target.value })} />

              <label className="mt-4 block text-xs text-studio-muted">Video Prompt</label>
              <textarea className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-6 outline-none focus:border-studio-cyan" value={sceneDraft.video_prompt || ""} onChange={(e) => setSceneDraft({ ...sceneDraft, video_prompt: e.target.value })} />

              <label className="mt-4 block text-xs text-studio-muted">Negative Prompt</label>
              <textarea className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-6 outline-none focus:border-studio-cyan" value={sceneDraft.image_negative_prompt || ""} onChange={(e) => setSceneDraft({ ...sceneDraft, image_negative_prompt: e.target.value })} />
            </div>
          </div>

          <div className="scrollbar-thin mt-4 flex gap-3 overflow-x-auto pb-1">
            {scenes.map((scene, index) => (
              <button key={scene.scene_id} onClick={() => setActiveScene(index)} className={`min-w-40 rounded-2xl border p-3 text-left ${activeScene === index ? "border-studio-cyan bg-studio-cyan/10" : "border-white/10 bg-white/5"}`}>
                <p className="text-xs text-studio-muted">{scene.time_range}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold">{sceneNarration(scene) || scene.scene_purpose}</p>
                <p className="mt-2 text-xs text-studio-muted">{scene.image_approved ? "图片已确认" : scene.image_url ? "待确认图片" : "待生成图片"}</p>
              </button>
            ))}
          </div>
        </section>

        <aside className="glass-card min-h-0 overflow-auto rounded-3xl p-4 scrollbar-thin">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-studio-muted">Review</p>
              <h2 className="mt-1 text-xl font-black">剧本 JSON</h2>
            </div>
            <Edit3 className="h-5 w-5 text-studio-muted" />
          </div>
          <p className="mt-3 text-xs leading-5 text-studio-muted">这里可以直接改生成的剧本、旁白 beat、角色、图片 Prompt、视频 Prompt。保存后再点“确认使用当前剧本”。</p>
          <textarea className="mt-4 h-[420px] w-full rounded-2xl border border-white/10 bg-black/30 p-3 font-mono text-xs leading-5 outline-none focus:border-studio-cyan" value={planJson} onChange={(e) => setPlanJson(e.target.value)} placeholder="执行 story.generate 后会出现可编辑 JSON" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={savePlanJson} disabled={!project?.plan || loading} className="gap-2"><Save className="h-4 w-4" />保存 JSON</Button>
            <Button onClick={approvePlan} disabled={!project?.plan || loading} className="gap-2"><CheckCircle2 className="h-4 w-4" />确认剧本</Button>
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
