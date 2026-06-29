import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anime Agent Studio",
  description: "AI 动漫短剧生成工作台：剧本、角色、分镜、图片、视频、配音、合成。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
