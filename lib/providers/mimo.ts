import { postJson } from "@/lib/providers/http";

const MIMO_BASE_URL = process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com/v1";
const MIMO_API_KEY = process.env.MIMO_API_KEY || "";

function mimoHeaders() {
  if (!MIMO_API_KEY) throw new Error("缺少 MIMO_API_KEY，请先复制 .env.example 并配置 .env.local");
  return { "api-key": MIMO_API_KEY };
}

type MiMoResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      audio?: {
        data?: string;
        format?: string;
      };
    };
  }>;
};

export async function mimoGenerateSpeech(params: {
  text: string;
  styleInstruction?: string;
  voiceDesignPrompt?: string;
  useVoiceDesign?: boolean;
  format?: "wav" | "mp3" | "pcm16";
}) {
  const useVoiceDesign = params.useVoiceDesign ?? true;
  const model = useVoiceDesign
    ? process.env.MIMO_TTS_VOICE_DESIGN_MODEL || "mimo-v2.5-tts-voicedesign"
    : process.env.MIMO_TTS_MODEL || "mimo-v2.5-tts";

  const userContent = useVoiceDesign
    ? params.voiceDesignPrompt || "年轻、有张力、适合动漫短剧的中文配音，情绪变化明显。"
    : params.styleInstruction || "情绪自然，节奏清晰，适合短视频旁白。";

  const data = await postJson<MiMoResponse>(`${MIMO_BASE_URL}/chat/completions`, {
    model,
    messages: [
      { role: "user", content: userContent },
      { role: "assistant", content: params.text }
    ],
    audio: {
      format: params.format || "wav",
      optimize_text_preview: true
    },
    stream: false
  }, mimoHeaders());

  const audio = data.choices?.[0]?.message?.audio;
  const base64 = audio?.data;
  if (!base64) throw new Error(`MiMo TTS 未返回 audio.data：${JSON.stringify(data)}`);
  return { base64, format: audio?.format || params.format || "wav", raw: data };
}
