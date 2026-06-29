#!/usr/bin/env node
/**
 * Local provider smoke test for Anime Agent Studio.
 *
 * Usage:
 *   cp .env.example .env.local
 *   # fill AGNES_API_KEY and MIMO_API_KEY
 *   npm run check:apis
 *
 * This script intentionally does NOT print API keys.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const envLocal = path.join(root, ".env.local");

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv(envLocal);

const AGNES_API_KEY = process.env.AGNES_API_KEY;
const AGNES_BASE_URL = process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1";
const AGNES_CHAT_MODEL = process.env.AGNES_CHAT_MODEL || "agnes-2.0-flash";
const AGNES_IMAGE_MODEL = process.env.AGNES_IMAGE_MODEL || "agnes-image-2.1-flash";

const MIMO_API_KEY = process.env.MIMO_API_KEY;
const MIMO_BASE_URL = process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com/v1";
const MIMO_TTS_MODEL = process.env.MIMO_TTS_VOICE_DESIGN_MODEL || "mimo-v2.5-tts-voicedesign";

const outDir = path.join(root, "tmp");
fs.mkdirSync(outDir, { recursive: true });

function assertEnv(name, value) {
  if (!value) throw new Error(`Missing ${name}. Please set it in .env.local`);
}

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }

  if (!res.ok) {
    const details = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${details}`);
  }

  return data;
}

async function testAgnesChat() {
  assertEnv("AGNES_API_KEY", AGNES_API_KEY);
  const data = await postJson(`${AGNES_BASE_URL}/chat/completions`, {
    Authorization: `Bearer ${AGNES_API_KEY}`
  }, {
    model: AGNES_CHAT_MODEL,
    messages: [{ role: "user", content: "只回复两个字：成功" }],
    temperature: 0,
    stream: false
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Agnes chat did not return choices[0].message.content: ${JSON.stringify(data).slice(0, 500)}`);
  return { content };
}

async function testAgnesImage() {
  assertEnv("AGNES_API_KEY", AGNES_API_KEY);
  const data = await postJson(`${AGNES_BASE_URL}/images/generations`, {
    Authorization: `Bearer ${AGNES_API_KEY}`
  }, {
    model: AGNES_IMAGE_MODEL,
    prompt: "original anime boy protagonist, silver hair, blue eyes, black tactical coat, cinematic lighting, vertical 9:16",
    n: 1,
    aspect_ratio: "9:16"
  });

  const url = data?.data?.[0]?.url || data?.url;
  if (!url) throw new Error(`Agnes image did not return url: ${JSON.stringify(data).slice(0, 500)}`);
  return { url };
}

async function testMimoTts() {
  assertEnv("MIMO_API_KEY", MIMO_API_KEY);
  const data = await postJson(`${MIMO_BASE_URL}/chat/completions`, {
    "api-key": MIMO_API_KEY
  }, {
    model: MIMO_TTS_MODEL,
    messages: [
      { role: "user", content: "年轻男声，普通话，动漫短剧旁白，坚定、有力量、情绪清晰。" },
      { role: "assistant", content: "测试成功，动漫短剧工作台已准备就绪。" }
    ],
    audio: {
      format: "wav",
      optimize_text_preview: true
    },
    stream: false
  });

  const audio = data?.choices?.[0]?.message?.audio;
  const base64 = audio?.data;
  const format = audio?.format || "wav";
  if (!base64) throw new Error(`MiMo TTS did not return message.audio.data: ${JSON.stringify(data).slice(0, 500)}`);

  const ext = format.toLowerCase().includes("wav") ? "wav" : format.toLowerCase();
  const file = path.join(outDir, `mimo-tts-test.${ext}`);
  fs.writeFileSync(file, Buffer.from(base64, "base64"));
  return { file, bytes: fs.statSync(file).size, format };
}

async function main() {
  console.log("Anime Agent Studio provider smoke test");
  console.log("Keys: loaded from .env.local / process.env, not printed");
  console.log("");

  const results = [];

  for (const [name, fn] of [
    ["Agnes Chat", testAgnesChat],
    ["Agnes Image", testAgnesImage],
    ["MiMo TTS", testMimoTts]
  ]) {
    try {
      console.log(`▶ Testing ${name}...`);
      const result = await fn();
      console.log(`✅ ${name} OK`, result);
      results.push({ name, ok: true, result });
    } catch (error) {
      console.log(`❌ ${name} FAILED`);
      console.log(error instanceof Error ? error.message : String(error));
      results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    console.log("");
  }

  const ok = results.every((item) => item.ok);
  console.log(ok ? "All provider checks passed." : "Some provider checks failed. Check API keys, balance, model names, or network access.");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
