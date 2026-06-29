import { getJson, postJson } from "@/lib/providers/http";

const AGNES_BASE_URL = process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1";
const AGNES_API_KEY = process.env.AGNES_API_KEY || "";

function agnesHeaders() {
  if (!AGNES_API_KEY) throw new Error("缺少 AGNES_API_KEY，请先复制 .env.example 并配置 .env.local");
  return { Authorization: `Bearer ${AGNES_API_KEY}` };
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function agnesChatCompletion(params: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
}) {
  const data = await postJson<ChatResponse>(`${AGNES_BASE_URL}/chat/completions`, {
    model: params.model || process.env.AGNES_CHAT_MODEL || "agnes-2.0-flash",
    messages: [
      ...(params.system ? [{ role: "system", content: params.system }] : []),
      { role: "user", content: params.prompt }
    ],
    temperature: params.temperature ?? 0.8,
    stream: false
  }, agnesHeaders());

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Agnes chat 没有返回 message.content");
  return content;
}

type ImageResponse = {
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  url?: string;
};

export async function agnesGenerateImage(params: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  model?: string;
  imageUrls?: string[];
}) {
  const payload: Record<string, unknown> = {
    model: params.model || process.env.AGNES_IMAGE_MODEL || "agnes-image-2.1-flash",
    prompt: params.prompt,
    n: 1
  };

  if (params.negativePrompt) payload.negative_prompt = params.negativePrompt;
  if (params.aspectRatio) payload.aspect_ratio = params.aspectRatio;
  if (params.imageUrls?.length) {
    payload.model = process.env.AGNES_IMAGE_REFERENCE_MODEL || "agnes-image-2.0-flash";
    payload.image_urls = params.imageUrls;
  }

  const data = await postJson<ImageResponse>(`${AGNES_BASE_URL}/images/generations`, payload, agnesHeaders());
  const url = data.data?.[0]?.url || data.url;
  if (!url) throw new Error(`Agnes image 未返回 url：${JSON.stringify(data)}`);
  return { url, raw: data };
}

type VideoCreateResponse = {
  id?: string;
  task_id?: string;
  video_id?: string;
  data?: { id?: string; task_id?: string; video_id?: string };
};

type VideoStatusResponse = {
  id?: string;
  task_id?: string;
  status?: string;
  state?: string;
  video_url?: string;
  url?: string;
  remixed_from_video_id?: string;
  video_id?: string;
  progress?: number;
  error?: unknown;
  data?: {
    status?: string;
    state?: string;
    video_url?: string;
    url?: string;
    remixed_from_video_id?: string;
    output?: string | { url?: string };
  };
};

export async function agnesCreateVideo(params: {
  prompt: string;
  imageUrl?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  model?: string;
}) {
  const { width, height } = resolveVideoSize(params.aspectRatio || "9:16");
  const frameRate = 24;
  const numFrames = resolveNumFrames(params.durationSeconds || 6, frameRate);
  const payload: Record<string, unknown> = {
    model: params.model || process.env.AGNES_VIDEO_MODEL || "agnes-video-v2.0",
    prompt: params.prompt,
    width,
    height,
    frame_rate: frameRate,
    num_frames: numFrames
  };

  if (params.imageUrl) {
    payload.image = params.imageUrl;
    payload.mode = "ti2vid";
  } else {
    payload.mode = "text_to_video";
  }

  const data = await postJson<VideoCreateResponse>(`${AGNES_BASE_URL}/videos`, payload, agnesHeaders());
  const taskId = data.task_id || data.id || data.data?.task_id || data.data?.id;
  const videoId = data.video_id || data.data?.video_id;
  if (!taskId) throw new Error(`Agnes video 未返回 task_id：${JSON.stringify(data)}`);
  return { taskId, videoId, raw: data };
}

export async function agnesGetVideoStatus(params: { taskId?: string; videoId?: string }) {
  const videoModel = process.env.AGNES_VIDEO_MODEL || "agnes-video-v2.0";
  const data = params.videoId
    ? await getJson<VideoStatusResponse>(
        `${process.env.AGNES_STATUS_URL || "https://apihub.agnes-ai.com/agnesapi"}?video_id=${encodeURIComponent(params.videoId)}&model_name=${encodeURIComponent(videoModel)}`,
        agnesHeaders()
      )
    : await getJson<VideoStatusResponse>(`${AGNES_BASE_URL}/videos/${params.taskId}`, agnesHeaders());
  const status = data.status || data.state || data.data?.status || data.data?.state || "unknown";
  const nestedOutput = data.data?.output;
  const videoUrl =
    data.video_url ||
    data.url ||
    data.remixed_from_video_id ||
    data.data?.video_url ||
    data.data?.url ||
    data.data?.remixed_from_video_id ||
    (typeof nestedOutput === "string" ? nestedOutput : nestedOutput?.url);

  return { status, videoUrl, raw: data };
}

function resolveVideoSize(aspectRatio: string) {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1152, height: 768 };
    case "1:1":
      return { width: 1024, height: 1024 };
    case "9:16":
    default:
      return { width: 768, height: 1152 };
  }
}

function resolveNumFrames(durationSeconds: number, frameRate: number) {
  const rawFrames = Math.max(9, Math.round(durationSeconds * frameRate));
  return Math.min(441, Math.max(9, Math.round((rawFrames - 1) / 8) * 8 + 1));
}
