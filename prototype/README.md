# 早期原型文档

当前可运行应用已经迁移到仓库根目录的 Expo Router + React Native 工程，启动和构建方法见 [`../README.md`](../README.md)。

本目录仅保留早期产品研究、潮向规则、自定义 API 和实时语音方案文档，供后续迁移能力时参考；旧的 HTML/Vite/Capacitor 实现不再是运行入口。

实时语音的 Web PCM/WebSocket 实现现位于 `src/lib/audio-capture.web.ts`、`src/lib/realtime-asr.web.ts`，连续画像的证据指纹、来源清理和持久化实现位于 `src/lib/profile-runtime.ts` 与 `src/providers/app-state.tsx`。
