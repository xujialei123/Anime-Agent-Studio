import Link from "next/link";
import { ArrowRight, Clapperboard, Mic2, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  { icon: Sparkles, title: "Agent 自动编剧", desc: "自动拆解故事、角色、分镜、字幕和任务队列。" },
  { icon: Clapperboard, title: "角色一致性", desc: "先生成角色定稿，再生成每幕关键帧，减少角色跑偏。" },
  { icon: Video, title: "Agnes 图片/视频", desc: "封装文生图、图生图、文生视频、图生视频。" },
  { icon: Mic2, title: "MiMo 情绪配音", desc: "支持 voice design，让角色声音和剧情情绪匹配。" }
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-8">
      <div className="grid-bg absolute inset-0 pointer-events-none" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 shadow-glow">
            <Sparkles className="h-5 w-5 text-studio-cyan" />
          </div>
          <div>
            <p className="text-sm font-bold">Anime Agent Studio</p>
            <p className="text-xs text-studio-muted">AI 动漫短剧生成工作台</p>
          </div>
        </div>
        <Link href="/create"><Button>开始生成</Button></Link>
      </nav>

      <section className="relative mx-auto grid max-w-7xl items-center gap-10 py-24 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-studio-muted">
            Agnes + MiMo + Next.js Agent Workflow
          </div>
          <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
            一句话生成
            <span className="bg-gradient-to-r from-studio-purple via-studio-pink to-studio-cyan bg-clip-text text-transparent"> 动漫短剧 </span>
            全流程
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-studio-muted">
            从爽文主题到角色卡、分镜、关键帧、图生视频、配音、字幕和最终合成任务，全部交给 Agent 自动编排。
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/create">
              <Button className="gap-2">创建短剧 <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <Link href="/studio/demo">
              <Button variant="secondary">查看 Studio 布局</Button>
            </Link>
          </div>
        </div>

        <Card className="relative p-5">
          <div className="aspect-[9/12] rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_30%_15%,rgba(236,72,153,.35),transparent_26rem),linear-gradient(145deg,rgba(139,92,246,.18),rgba(34,211,238,.08))] p-5">
            <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
              <p className="text-xs text-studio-muted">Prompt</p>
              <p className="mt-2 text-xl font-bold">废柴少年被宗门抛弃，三年后觉醒龙魂归来复仇。</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <feature.icon className="mb-4 h-5 w-5 text-studio-cyan" />
                  <p className="font-semibold">{feature.title}</p>
                  <p className="mt-2 text-xs leading-5 text-studio-muted">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
