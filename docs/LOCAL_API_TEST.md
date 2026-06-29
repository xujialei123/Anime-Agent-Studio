# 本地联调 Agnes / MiMo

不要把真实 API Key 提交到 Git。请只写在本地 `.env.local`，或者部署平台的环境变量里。

## 1. 配置环境变量

```bash
cp .env.example .env.local
```

然后填写：

```env
AGNES_API_KEY=你的_agnes_key
MIMO_API_KEY=你的_mimo_key
```

## 2. 执行联调

```bash
npm run check:apis
```

脚本会测试：

1. Agnes Chat：检查文本模型是否可用。
2. Agnes Image：生成一张测试角色图，检查图像模型是否可用。
3. MiMo TTS：生成一段测试语音，保存到 `tmp/mimo-tts-test.wav`。

## 3. 常见错误

### DNS / 网络错误

说明当前机器无法访问官方 API 域名，换网络或检查代理。

### 401 / 403

通常是 API Key 错误、过期、权限不足，或者账户余额/套餐问题。

### model not found

检查 `.env.local` 里的模型名是否和官方文档一致。

### MiMo 没有返回 audio.data

确认合成文本放在 `assistant` message 中，音色描述放在 `user` message 中。

## 2026-06-15 Fix notes

If Agnes image generation returns an error similar to:

```txt
UnsupportedParamsError: Setting `response_format` is not supported by openai, agnes-t2i-general-model
```

remove `response_format` from image generation payloads. This project no longer sends `response_format` in `lib/providers/agnes.ts` or `scripts/check-apis.mjs`.

Also, narrator-only entries such as `旁白` should not be treated as visual characters. The task factory now filters out non-visual characters before creating `character.image.generate` tasks, and the task runner safely skips old narrator image tasks.
