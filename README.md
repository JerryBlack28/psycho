# 心潮

「心潮」是一个使用 Expo SDK 55、Expo Router 和 React Native 编写的跨平台心理叙事原型。同一套页面代码可以运行在 Web、Android 和 iOS；Android/iOS 的原生工程由 Expo Continuous Native Generation（CNG）按需生成，不保存在仓库中。

这些内容用于自我梳理，不是心理诊断、治疗、危机评估或专业服务。

## 当前技术栈

- Expo SDK 55、React 19.2、React Native 0.83；
- Expo Router 文件路由；
- Android/iOS 使用 `expo-router/unstable-native-tabs` 提供系统原生标签栏；
- Web 使用 `expo-router/ui` 和 React Native Web 提供等价的四标签导航；
- `AsyncStorage` 保存用户主动留下的闪念、潮笺、未来回响和本机 API 配置；Web 端会落到浏览器站点存储；
- 持续画像使用串行更新队列、证据指纹和来源删除联动，模型只返回并持久化可修正的文字观察；
- Web 端把麦克风实时转换为 16 kHz PCM 并直连讯飞 WebSocket，转写结果先回填输入框；
- Expo CNG 在本地或 GitHub Actions 中临时生成 `android/`、`ios/`。

NativeTabs 在 Expo Router SDK 55 中仍是 alpha API，升级 Expo SDK 时需要重新核对 API。原生标签栏会跟随系统：iOS 使用系统 tab bar，并在支持的系统版本上采用相应系统视觉效果；Android 使用系统 Material tabs。Web 不会模拟 iOS Liquid Glass，而是使用独立的 React Native Web 导航壳。

## 网页版启动

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run web
```

Expo 默认会显示本地访问地址，通常是 <http://localhost:8081>。网页端支持热更新，修改 `src/` 后浏览器会自动刷新。

桌面浏览器会把整个 Router 放在原版 390 × 844 px 的手机原型框中，页面滚动、二级页面、弹层和四标签导航都限制在框内；浏览器宽度小于 760px 时自动铺满整个窗口。这个框只用于 Web 展示，不会进入 Android/iOS 原生界面。

生成可部署的静态网页：

```bash
npm run export:web
```

输出目录为 `dist/`。

## 在 Android/iOS 上开发

使用 Expo 开发服务器：

```bash
npm run android
npm run ios
```

需要生成本机原生工程或调试原生配置时：

```bash
npx expo prebuild --clean
npx expo run:android
npx expo run:ios
```

`android/` 和 `ios/` 已被 Git 忽略。它们是 CNG 产物，修改跨平台配置时应优先编辑 [`app.json`](app.json) 或 Expo config plugin，不要依赖手工修改生成目录。

应用标识：

```text
com.xinchao.psycho
```

## GitHub Actions 构建

工作流位于 [`.github/workflows/mobile-build.yml`](.github/workflows/mobile-build.yml)，支持手动运行，也会在推送 `v*` tag 时运行。

工作流不会要求仓库保存 `android/` 或 `ios/`：

1. 执行 `npm ci`；
2. 使用 `expo prebuild --clean --no-install` 生成对应原生工程；
3. Android 构建 debug APK；
4. iOS 构建无需签名的 Simulator `.app` 并压缩；
5. 两个平台都上传为 GitHub Actions artifacts，默认保留 14 天。

当前工作流生成的是测试产物，不会创建 GitHub Release，也不会自动签名商店安装包。发布 Google Play 或 App Store 需要另外配置 Android keystore、Apple Developer 签名与商店凭据。

## 一比一迁移范围

当前 React Native 页面以迁移前 Git 历史中的 `prototype/index.html`、`styles.css` 和 `app.js` 为基准，保留原页面层级、文案和主要交互，不再嵌入或运行旧 HTML。

四个主标签使用同一套 Expo Router 路由：

- **今天**：今日潮汐、答案之书、章节与未来回响入口；
- **闪念**：卡片堆叠、文字、相册/相机图片、图片权利确认、语音录制入口与本机索引；
- **对话**：快捷表达、文字与语音入口、本地降级、AI 按次授权和安全提示；
- **我的**：我的时光月历、月度回顾、自定义模型/讯飞 API、画像授权、收藏与数据管理。

潮笺卡槽和未来回响恢复为二级页面，不占用底部标签。章节保留闪念、主题确认、概览、六张情境卡、拖动/键盘选择、四股潮向、潮笺弹层、章节内对话、微行动、未来回响和完成页。日报、章节、卡槽和回响位于原生 Stack 路由中；iOS 原生返回手势由 Stack 自带，Web 使用页面内返回按钮。

网页版的三个麦克风入口已经恢复原型中的讯飞实时转写：鉴权签名、40 ms PCM 分帧、背压控制、临时/确认文本合并和结束帧都在 React 代码中运行。Expo Audio 当前不向 JavaScript 暴露原生录音器的实时 PCM 帧，因此 Android/iOS 入口暂时只做不落盘的本机录音，不会伪装成已经上传或转写；若要让原生端也实时转写，需要再接入带 Expo config plugin 的原生 PCM 采集模块。

持续画像会在用户同时开启「按次使用 AI」和「持续更新本机画像」后工作。闪念、确认后的语音文字、章节选择、聊天表达、潮笺和已授权图片会进入串行队列；相同证据不会重复请求，关闭授权会中止在途更新，删除来源时会同步移除画像中的相关证据。生成结果只保存为本机文字画像，可单独删除。

## 自定义模型 API

在「我的 → 自定义模型 API」填写：

1. OpenAI 兼容的 Base URL，例如 `https://provider.example/v1`；
2. API Key；
3. 服务商实际提供的模型名。

可以先测试，再保存到当前设备。开启「按次使用 AI 服务」后，对话会直接访问服务商的 `/chat/completions`；未配置、未开启或请求失败时自动使用本地陪伴回复。

纯前端无法真正隐藏 API Key。移动端的 `AsyncStorage` 和 Web 的站点存储都不适合保存高权限生产密钥；请仅使用可轮换、限额的测试密钥。网页版直连还要求服务商允许 CORS，HTTPS 网页也不能请求 HTTP API。

## 本机数据边界

| 数据 | 持久化 | 说明 |
| --- | --- | --- |
| 闪念 | `AsyncStorage` | 保存文字、时间、表达标签和是否曾附图；不保存图片文件 |
| 潮笺卡槽 | `AsyncStorage` | 只保存内置卡片 ID、短句与收藏时间 |
| 未来回响 | `AsyncStorage` | 仅在用户主动封存后保存，解封前隐藏正文 |
| 答案之书 | `AsyncStorage` | 只保存当天卡片序号，不记录用户心里的问题 |
| 自定义 API | `AsyncStorage` | Base URL、模型和 API Key，可在设备存储中读取 |
| 连续画像 | `AsyncStorage` | 只保存模型返回的文字观察、证据来源 ID 和更新时间；不保存原始语音 |
| 讯飞配置 | `AsyncStorage` | APPID、APIKey 和 APISecret，可在设备存储中读取 |
| 对话和章节选择 | 页面内存 | 离开或刷新后清除；开启 AI 后，当次对话会发送给用户配置的服务商 |

## 目录

```text
src/
├── app/                 # Expo Router 页面与布局
│   ├── (tabs)/          # 四个主标签：今天、闪念、对话、我的
│   ├── chapter.tsx      # 今日章节主线
│   ├── cards.tsx        # 潮笺卡槽二级页
│   ├── daily-report.tsx
│   └── echoes.tsx
├── components/          # React Native UI 与平台导航壳
├── constants/           # 颜色和布局主题
├── data/                # 本地叙事、潮向和日报内容
├── lib/                 # 模型 API、实时转写、画像队列与本机存储
└── providers/           # 应用状态
```

`prototype/` 中只保留早期产品与数据边界设计文档，不再作为应用入口。
