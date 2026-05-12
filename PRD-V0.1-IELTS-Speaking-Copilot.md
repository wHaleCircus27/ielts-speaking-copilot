# PRD V0.1: IELTS Speaking Copilot

## 1. 背景与目标

IELTS Speaking Copilot 是一款面向雅思口语老师的本地桌面批改工作台。V0.1 的目标是先完成一个稳定可用的桌面端 MVP，减少老师在听录音、转写、整理批注和复制反馈之间的手工成本。

V0.1 聚焦单机桌面工作流：老师拖拽本地音频或视频文件，应用完成 ASR 转录，展示带时间戳的转录片段，老师可点击片段精准回听，再由 LLM 生成结构化批改内容，最后人工微调并复制输出。

## 2. V0.1 范围

V0.1 必须包含：

- Tauri + Next.js + React + Tailwind 桌面应用基础结构。
- 本地拖拽导入音频或视频文件。
- HTML5 音视频播放器。
- ASR 转录，输出带时间戳的文本片段。
- 交互式转录列表，点击片段可跳转播放器到对应时间并播放。
- LLM 流式生成 Markdown 格式雅思口语批注。
- 批注内容可编辑。
- 一键复制最终批注到剪贴板。
- 设置页支持配置 API Key、ASR provider/model、LLM provider/model。
- 明确的加载、失败、重试和未配置状态提示。

## 3. 非 V0.1 范围

V0.1 不实现以下功能：

- Chrome 浏览器扩展。
- 网页媒体嗅探。
- 一键回填网页评论框。
- RAG 习惯库。
- 批量导入历史批注。
- Embedding 向量检索。
- 反向学习或自动沉淀老师习惯。
- 多用户账号体系。
- 云端同步。
- 正式发布签名、公证和自动更新。

## 4. 用户流程

1. 老师打开桌面应用。
2. 首次使用时进入设置页，配置 ASR 和 LLM 所需的 API Key 与模型。
3. 老师回到工作台，将本地音频或视频文件拖拽到导入区域。
4. 应用加载媒体并显示播放器。
5. 老师点击“开始转录”或应用在导入后自动触发转录。
6. ASR 完成后，左下区域展示带时间戳的转录片段。
7. 老师点击任意转录片段，播放器跳转到该片段起始时间并播放。
8. 老师点击“生成批注”，应用将完整转录文本发送给 LLM。
9. 右侧区域流式展示批改内容。
10. 老师在右侧编辑最终批注。
11. 老师点击“复制”，将最终内容复制到剪贴板。

## 5. 功能需求

### 5.1 设置页

- 支持配置 ASR provider、ASR model、LLM provider、LLM model。
- 支持输入、更新和删除 API Key。
- 发起 ASR 或 LLM 请求前必须检查配置完整性。
- 配置缺失时，工作台显示可操作提示，引导用户进入设置页。
- API Key 应仅保存在本地。优先使用系统安全存储；若实现阶段暂不可用，必须在代码和文档中标记为临时方案。

### 5.2 媒体导入与播放

- 支持拖拽导入 `.mp3`、`.m4a`、`.wav`、`.mp4`、`.mov` 等常见音视频格式。
- 导入后显示文件名、文件类型、媒体时长和当前处理状态。
- 根据文件类型渲染原生 `<audio>` 或 `<video>` 播放器。
- 播放器必须支持播放、暂停、进度拖动和程序化 seek。

### 5.3 ASR 转录

- ASR 请求必须返回或可转换为带时间戳的片段格式。
- 内部统一结构为 `TranscriptSegment[]`。
- 转录中显示进度状态；失败时显示错误原因和重试入口。
- 首版允许限制单个媒体文件大小和时长，默认建议不超过 25MB 或 20 分钟。

### 5.4 交互式转录

- 转录区域按片段展示文本。
- 每个片段显示起止时间，例如 `[00:12 - 00:18]`。
- 点击片段文本或时间戳时，播放器设置 `currentTime = segment.start` 并开始播放。
- 当前播放时间落入某片段范围时，可高亮该片段。

### 5.5 AI 批注生成

- 使用完整转录文本作为 LLM 输入。
- 输出必须使用固定 IELTS 口语批改结构：
  - 总评
  - 优点
  - 主要问题
  - 原句与修改建议
  - 提升建议
  - 可直接发送给学生的最终评语
- 支持流式输出。
- 生成失败时保留已有转录和用户已编辑内容。

### 5.6 批注编辑与复制

- AI 输出完成后，右侧内容进入可编辑状态。
- 老师可直接修改批注。
- 点击复制时，复制编辑区当前最终文本，而不是原始 AI 输出缓存。
- 复制成功和失败都必须有明确提示。

## 6. 数据模型

### 6.1 AppSettings

- `asrProvider`: string
- `asrModel`: string
- `llmProvider`: string
- `llmModel`: string
- `apiKeys`: provider 到 key 的本地安全映射
- `updatedAt`: ISO timestamp

### 6.2 MediaJob

- `id`: string
- `fileName`: string
- `fileType`: string
- `fileSize`: number
- `duration`: number | null
- `status`: `idle | loaded | transcribing | transcribed | generating | ready | failed`
- `errorMessage`: string | null
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

### 6.3 TranscriptSegment

- `id`: string
- `jobId`: string
- `start`: number
- `end`: number
- `text`: string

### 6.4 FeedbackDraft

- `id`: string
- `jobId`: string
- `content`: string
- `source`: `ai | edited`
- `createdAt`: ISO timestamp
- `updatedAt`: ISO timestamp

## 7. AI Provider 需求

- V0.1 默认支持至少一个 ASR provider 和一个 LLM provider。真实 ASR provider 包括 OpenAI、Groq、NVIDIA。
- ASR provider 必须能返回时间戳信息，或通过响应内容可靠转换出片段时间。V0.1 允许 NVIDIA ASR 先以整段媒体时长生成单个 `TranscriptSegment`，作为真实转写可用但非精细时间戳的 fallback。
- LLM provider 必须支持普通响应；优先支持 streaming。
- Provider 层需要抽象接口，避免业务 UI 直接绑定某一家 API。
- 网络失败、认证失败、余额不足、模型不存在、文件过大等错误应转换为用户可读提示。

## 8. UI 布局要求

主工作台采用三区布局：

- 左上：媒体导入区和播放器。
- 左下：转录片段列表。
- 右侧：AI 批注生成、编辑和复制区域。

UI 风格要求：

- 极简、现代、工作台导向。
- 优先信息密度和可读性，不做营销页。
- 控件状态明确：未导入、已导入、转录中、生成中、失败、完成。
- 主要操作按钮包括：导入/重新选择、开始转录、生成批注、复制。

## 9. 错误状态与限制

必须处理以下情况：

- API Key 未配置。
- 文件格式不支持。
- 文件过大或时长过长。
- 媒体无法播放。
- ASR 请求失败。
- ASR 返回空文本。
- LLM 请求失败。
- 复制到剪贴板失败。
- 用户在生成中切换文件。

默认限制：

- 单个文件大小建议上限：25MB。
- 单个文件时长建议上限：20 分钟。
- 超过限制时显示说明，不直接崩溃。

## 10. 验收标准

V0.1 完成时必须满足：

- 可以拖拽本地音频或视频文件进入工作台。
- 媒体文件可以正常播放、暂停和 seek。
- ASR 成功后，界面按片段展示转录文本和时间戳。
- 点击任意转录片段，播放器跳转到对应起始时间并播放。
- AI 批注以流式方式输出。
- 输出完成后，老师可以编辑批注。
- 点击复制后，剪贴板内容与编辑区最终文本一致。
- API Key 或模型未配置时，应用给出明确提示。
- ASR/LLM 失败时，应用显示错误并允许重试。

## 11. 测试计划

- 拖拽 `.mp3`、`.m4a`、`.wav`、`.mp4`、`.mov` 文件。
- 测试短音频、空音频、损坏文件、超大文件、超长文件。
- 验证 click-to-seek 时间误差不超过 300ms。
- 验证转录片段高亮与当前播放时间基本一致。
- 验证未配置 API Key 时无法发起 ASR/LLM 请求。
- 验证 ASR 失败时可重试，且媒体状态不丢失。
- 验证 LLM 失败时保留转录内容。
- 验证复制内容与编辑区最终文本一致。

## 12. 后续版本路线

### V0.2 浏览器闭环

- Chrome Manifest V3 插件。
- 标准 `<audio>` / `<video>` 媒体提取。
- 插件向本地 App 发送媒体。
- 本地 App 将最终批注回传插件。
- 插件回填 textarea/contenteditable。

### V0.3 个性化增强

- 习惯库 CRUD。
- 历史批注批量导入。
- Embedding 生成和本地向量检索。
- 基于相似历史批注的个性化 LLM prompt。
- 将本次批改加入习惯库。

### V1.0 发布准备

- macOS 打包、签名、公证。
- 更完整的错误日志和诊断。
- 数据删除和隐私设置。
- 安装说明和用户文档。
