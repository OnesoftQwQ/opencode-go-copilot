# OpenCode Go Copilot Provider — AGENTS.md

> **所有更改必须通过 `npm run compile` / `npx tsc --noEmit` 编译检查无错误通过。**  
> **每次更改后，必须同步更新本文档 (`AGENTS.md`) 以反映代码变更。**

---

## 目录

1. [项目详细介绍](#1-项目详细介绍)
2. [详细逻辑架构](#2-详细逻辑架构)
3. [程序文件索引](#3-程序文件索引)
4. [函数定义大全](#4-函数定义大全)
5. [编译与构建](#5-编译与构建)
6. [开发规范](#6-开发规范)

---

## 1. 项目详细介绍

### 1.1 概述

**OpenCode Go Copilot Provider** 是一个 VS Code 扩展，它将 OpenCode Go 平台的 AI 语言模型集成到 GitHub Copilot Chat 中。用户可以在 VS Code 的 Copilot Chat 界面中选择并使用 OpenCode Go 提供的各种模型（如 DeepSeek、GLM、Qwen、MiMo、MiniMax、Kimi 等系列），享受智能代码补全、聊天对话、Git 提交消息生成等功能。

### 1.2 核心能力

| 能力                         | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat 模型提供商**          | 实现 `LanguageModelChatProvider` 接口，向 VS Code 注册为 `opencodego` 厂商                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **多模型支持**               | 模型列表完全由 `models.dev` 目录驱动（`catalog.json` 的 `opencode-go` 服务商），覆盖 GLM、Kimi、DeepSeek、MiMo、MiniMax、Qwen 等全系列模型（含 gpt-5.6-luna、grok-4.5、hy3、qwen3.8-max 等新模型），统一通过推理强度选择器切换思考模式。可选开启 OpenCode Zen 免费模型（`opencode` 服务商，`-free` 后缀过滤 + 硬编码免费模型补充，见下）。元数据（上下文长度、视觉、思考模式、温度支持、API 端点等）全部自动获取，无需硬编码模型列表                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **自动模型发现**             | 模型列表以 `models.dev` 目录为唯一数据源（1 分钟 TTL 缓存，兼作启动并发激活去重）。通过 `opencodego.enableAutoModelDiscovery` 配置（默认开启）控制是否从 `/zen/go/v1/models` 获取实际可用列表过滤模型选择器（不可用模型隐藏，API 不可用则显示目录全量）。服务商 URL、模型列表、参数（含 `reasoning_options` 思考强度）均从目录自动获取；API 不可用时目录不可用的降级为空列表，待下次拉取恢复                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **目录容灾回退**             | 目录获取采用三级回退链：官方 `models.dev`（10 秒超时）→ 镜像（`opencodego.modelsDevMirrorUrl`，默认 `https://modelsdev-mirror.onesoft.top/catalog.json`，30 秒超时，请求头携带 `platform: opencode-go-copilot` 及可选 `x-mirror-token`）→ 硬编码兜底目录快照。镜像/兜底命中时按 1 分钟间隔持续重试官方源，官方恢复后自动切回                                                                                                                                                                                                                                                                                                                                                                                                   |
| **OpenCode Zen 免费模型**    | 通过设置开关启用，从 `models.dev` 目录的 `opencode` 服务商获取模型列表并过滤出免费模型（`-free` 后缀约定 + 硬编码集合 `ZEN_FREE_EXTRA_IDS` 补充无后缀免费模型，如 `big-pickle`），以 `OpenCode Zen` 标识追加到模型选择器。元数据合并链与 Go 模型完全统一：`MODEL_OVERRIDES` > 目录条目 > 保守默认值。支持内存缓存（1 分钟 TTL）                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **三 API 模式**              | 根据 `models.dev` 的模型级 `provider.npm`（缺失时继承服务商 `npm`）区分 **OpenAI 兼容格式** (`/chat/completions`)、**OpenAI Responses 格式** (`/responses`) 和 **Anthropic 格式** (`/v1/messages`)；旧目录缺少适配器信息时才使用 family 启发式兜底                                                                                                                                                                                                                                                                                                                                             |
| **流式推理**                 | 支持 SSE (Server-Sent Events) 流式响应，实时输出文本和工具调用                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Thinking/推理**            | 支持模型的推理过程展示 ("thinking" 状态)，包括 XML think 块解析                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **工具调用 (Tool Calling)**  | 支持 VS Code 的 LanguageModelToolCallPart 机制                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **图片代理 (Tool-based)**    | 为不支持视觉的模型注入 `ask_image` 工具，模型可自主选择调用视觉模型（默认 Qwen3.6-Plus）回答关于图片的具体问题，支持多轮 API 请求完成"调用工具→提问→获取答案→继续回答"的完整流程。与旧版 `describe_image` 不同，`ask_image` 允许模型针对图片提出具体问题（如"按钮是什么颜色？"），视觉模型会针对性回答。每次内部视觉调用完成后还会输出专用 MIME 的 `LanguageModelDataPart`，下一轮从该记录重建标准 tool call + tool result，保持跨轮上下文。视觉模型 ID、查询提示词和思考模式均可通过设置配置；视觉代理会在同一个 thinking 块中显示“正在根据图片提问：[问题]”并实时追加视觉模型流式输出                                                                                                                                                                        |
| **MCP 工具图片支持**        | 完整支持 MCP 工具（如 Chrome DevTools `take_screenshot`、photoshop-mcp 等）返回的图片：`type: image`/带 blob 的 `resource` 直接以图片 data part 接收；`resource`/`resource_link`（无 blob）则以 `application/vnd.code.resource-link` data part 接收，扩展会解析其中的 URI 并通过 `vscode.workspace.fs.readFile` 读取实际图片字节（VS Code 为 `vscode-chat-response-resource://` 注册了文件系统提供者）。视觉模型直接收到图片（image_url/image block），非视觉模型存入 `_localImages` 供 `ask_image` 代理使用；解析失败时以文本形式提示 URI                                                                                                                                                                                                                                                                                                                                                                                             |
| **Token 计数**               | 使用 `o200k_base` tiktoken 分词器精确统计 token 用量                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **状态栏**                   | 实时显示当前会话 token 使用量、累计用量、缓存命中率                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **原生 Token 指示器**        | 始终启用，向 Copilot Chat 原生 Token 指示器报告 token 用量。通过发送 MIME 类型为 `usage` 的 `LanguageModelDataPart`（TextEncoder 编码 JSON）实现，无需自建状态栏。依赖 VS Code/Copilot Chat 1.116+ 对外部模型 `usage` data part 的识别                                                                                                                                                                                                                                                                                                                                                  |
| **高级 Token 指示器**        | 可通过 `opencodego.enableThirdPartyTokenIndicator` 配置（默认开启）控制 VS Code 状态栏中的高级Token计数器。状态栏主文本显示 Go 套餐用量（见下），累计 Token 信息展示在悬停提示中。关闭后仅显示原生指示器                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **套餐用量监控**             | 从官方用量端点 `GET /zen/go/v1/usage`（2026-08-11 上线，anomalyco/opencode#16513）拉取 Go 套餐用量：5 小时滚动 / 周 / 月三个窗口的使用率与重置时间，以及 `useBalance` 余额回退标志。状态栏主文本默认显示 5H 窗口用量（`$(symbol-numeric) Go 5H 65%`，无数据时 `Go --`）；悬停提示中展示三窗口明细与 5h 窗口重置倒计时（`opencodego.showUsageInTooltip` 控制 tooltip 区块，默认开启），后台按 `opencodego.usageRefreshInterval` 间隔轮询（默认 5 分钟，1-60 可调）；点击状态栏条目或运行 `opencodego.checkUsage` 命令可强制立即刷新并弹窗显示摘要。无 API Key 时不轮询，401（无 Go 套餐）与网络失败均静默降级、仅记录日志，响应字段名宽容解析（`percent`/`usagePercent`、`resetsAt`/`resetInSec` 双兼容）                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Git 提交消息生成**         | 一键生成 Conventional Commit 格式的 Git 提交消息，支持 `auto` 语言模式自动从历史提交检测语言                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **多仓库支持**               | 支持多根工作区 (multi-root) 中多个 Git 仓库的提交消息生成                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **模型预设**                 | 支持通过命令面板快速切换 temperature/top_p 预设（🎯 Precise/⚖️ Balanced/🔥 Creative），也支持手动自定义输入                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **国际化**                   | 内置简体中文 (zh-cn) 中英文双语界面                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **重试机制**                 | 可配置的指数退避重试策略，应对网络抖动和限流 (429)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **请求延迟**                 | 可配置的请求间隔延迟，避免触发 API 限流                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **超时控制**                 | 可配置的请求超时时间（默认 10 分钟）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **HTTP 安全检查**            | 始终强制校验 Base URL：拒绝非 HTTP 协议；针对 `http:` 协议仅允许 localhost、127.0.0.1、::1、192.168.\*、10.\*、0.0.0.0 等本地/私有网络地址，远程端点强制使用 HTTPS                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **立即取消**                 | 取消请求时通过 `reader.cancel()` 立即中断流式读取，停止后台接收                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **视觉代理配置**             | 支持通过设置 `opencodego.visionProxyModel`、`opencodego.visionProxyThinking` 配置图片代理所使用的视觉模型和思考模式。`opencodego.visionProxyThinking` 默认关闭，关闭时内部请求通过 `modelOptions.thinking={ type: false }` / `reasoning_effort="disabled"` 禁用视觉模型思考，最终 OpenAI 兼容请求体发送 `thinking: { type: false }`                                                                                                                                                                                                                                                     |
| **安装欢迎页 (Walkthrough)** | 首次安装且未配置 API Key 时自动打开引导向导，指引用户设置 API Key 和打开语言模型管理器。包含 3 个步骤：设置 API Key、显示模型、高级设置。通过 `onStartupFinished` 激活事件确保在 VS Code 启动后立即检测                                                                                                                                                                                                                                                                                                                                                                                 |

### 1.3 模型清单

> **模型列表 100% 由 `models.dev` 目录驱动**（`catalog.json`，1 分钟缓存）。模型 ID、显示名、上下文长度、输出上限、视觉能力、思考模式、思考强度、温度支持、API 端点 URL 均从目录自动获取，无内置硬编码模型列表。`src/modelOverrides.ts` 仅维护 models.dev 无法表达的少量覆盖项（如 Anthropic 格式的 apiMode、`reasoning_split` 参数）。

#### 模型来源

| 服务商 (Provider) | 来源 | 过滤规则 | 分组 (family) |
| ----------------- | ---- | -------- | ------------- |
| `opencode-go`（OpenCode Go） | `catalog.json` → `providers["opencode-go"].models` | 可选按 API `/models` 列表过滤可用性 | `OpenCodeGo` |
| `opencode`（OpenCode Zen） | `catalog.json` → `providers["opencode"].models` | `-free` 后缀 + 硬编码集合（`big-pickle`） | `OpenCode Zen` |

> Go 服务商当前收录模型包括但不限于：`glm-5/5.1/5.2`、`kimi-k3/k2.5/k2.6/k2.7-code`、`deepseek-v4-pro/flash`、`mimo-v2-pro/omni/v2.5-pro/v2.5`、`minimax-m3/m2.7/m2.5`、`qwen3.5/3.6/3.7-plus`、`qwen3.7-max`、`qwen3.8-max`、`gpt-5.6-luna`、`grok-4.5`、`hy3` 等。实际显示取决于目录收录与 API 可用性。
> Zen 免费模型（`-free` 后缀）包括但不限于：`big-pickle`、`deepseek-v4-flash-free`、`minimax-m3-free`、`minimax-m2.5-free`、`ring-2.6-1t-free`、`nemotron-3-super-free` 等。
> 兜底快照：`src/hardcodedModelList.ts` 内置 2026-08-04 的官方目录快照，含 opencode-go（24 个）与 opencode（85 个，其中 22 个 `-free` 免费模型）的**完整模型元数据**（limit、cost、reasoning_options、attachment、modalities 等），仅作官方目录与镜像均不可达时的最后防线。发布构建（`.github/workflows/release.yml`）会先运行 `scripts/update-hardcoded-catalog.mjs` 自动刷新该快照（拉取官方目录 → 提取两个服务商 → 重写文件），失败时保留旧快照不阻断构建；数据有变化时随版本号变更在同一 commit 推送。

#### 思考强度自动推导（`reasoning_options`）

models.dev 目录通过 `reasoning_options` 字段提供每个模型的思考能力，映射规则：

| 目录数据 | 推导结果 | 示例 |
| -------- | -------- | ---- |
| `{"type":"effort","values":["high","max"]}` | `switchable`，强度档 `高/极高`（含 `禁用思考`） | deepseek-v4-*、glm-5.2、kimi-k3 (`["max"]`) |
| `{"type":"effort","values":[...,"none",...]}` | `switchable`，`none` 映射为 `禁用思考` 档 | gpt-5.6-luna（6 档）、hy3 |
| `{"type":"toggle"}` | `switchable`，仅 `禁用思考/思考` | qwen3.x、minimax-m3 |
| `reasoning=true` 且 `reasoning_options=[]` | `always`（思考常开，无开关） | glm-5/5.1、kimi-k2.x、mimo 系列 |
| `{"type":"budget_tokens","max":N}` | `thinking_budget`（OpenAI 模式请求体 `budget_tokens`） | qwen3.5/3.6 (81920)、qwen3.7/3.8 (262144) |

> **关于图像输入：** 所有模型（包括非视觉模型）的 `imageInput` 能力均声明为 `true`，以确保 VS Code 始终传递图片数据。非视觉模型通过内部的 `ask_image` 工具代理机制处理图片，不直接支持视觉输入。视觉模型可直接接收工具结果（如内置 `view_image`）返回的图片 data part，以及 MCP 工具返回的 resource-link 图片（解析后发送）。

---

## 2. 详细逻辑架构

### 2.1 总体数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VS Code Copilot Chat                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  用户发送消息 → LanguageModelChatProvider                     │  │
│  │                    ↓                                          │  │
│  │  OpenCodeGoChatModelProvider (provider.ts)                    │  │
│  │   1. 获取模型配置 (getCatalogModelConfig)                     │  │
│  │   2. 获取 API Key (SecretStorage)                             │  │
│  │   3. 计算 Token 用量 (provideToken → statusBar)               │  │
│  │   3b. 可选: 向 Copilot Chat 原生 Token 指示器报告用量          │  │
│  │       (LanguageModelDataPart, MIME type "usage", VS Code 1.116+)│  │
│  │   4. 应用请求延迟 (delay)                                     │  │
│  │   5. 构建请求 → API 路由选择                                  │  │
│  │      ├─ apiMode="openai"           → OpenaiApi                │  │
│  │      ├─ apiMode="openai-responses" → ResponsesApi            │  │
│  │      └─ apiMode="anthropic"        → AnthropicApi             │  │
│  │   6. 发送 HTTP 请求 (fetch with undici + 超时控制)             │  │
│  │   7. 流式解析响应 → Progress<LanguageModelResponsePart2>      │  │
│  │      ├─ LanguageModelTextPart     (文本)                      │  │
│  │      ├─ LanguageModelThinkingPart (推理过程)                  │  │
│  │      └─ LanguageModelToolCallPart (工具调用)                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        Git 提交消息生成                              │
│  SCM 标题栏按钮 → generateCommitMsg()                              │
│    → 获取 Git Diff (gitUtils.ts)                                   │
│    → 获取最近提交风格参考                                          │
│    → 构建 prompt → 调用 API (OpenaiApi/AnthropicApi)               │
│    → 流式输出到 SCM InputBox                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 扩展激活流程

```
activate(context)
  ├── logger.init()                         ← 创建 LogOutputChannel
  ├── TokenizerManager.initialize()         ← 加载 o200k_base.tiktoken
  ├── initStatusBar()                       ← 创建状态栏条目
  ├── new OpenCodeGoChatModelProvider()      ← 创建 Provider 实例
  ├── vscode.lm.registerLanguageModelChatProvider("opencodego", provider)
  ├── 预热模型发现 (非阻塞 fire-and-forget)  ← 每次激活刷新模型列表（先 models.dev 后模型列表，1 分钟 TTL 去重并发激活）
  ├── 注册命令:
  │   ├── opencodego.setApiKey                ← 设置 API Key
  │   ├── opencodego.getApiKey                ← 打开 OpenCode AI 官网获取 Key
  │   ├── opencodego.openSettings             ← 打开扩展设置页
  │   ├── opencodego.generateGitCommitMessage ← 生成提交消息
  │   ├── opencodego.abortGitCommitMessage    ← 中止生成
  │   ├── opencodego.setModelPreset           ← 设置模型预设
  │   └── opencodego.checkUsage              ← 查询/刷新 Go 套餐用量
  ├── showWelcomeIfNeeded()                 ← 首次安装时显示欢迎向导
  └── 注册 dispose 清理
```

### 2.3 聊天请求处理流程

```
provideLanguageModelChatResponse(model, messages, options, progress, token)
  │
  ├── 1. 解析模型 ID → getCatalogModelConfig(model.id)
  │       格式: "baseId"（无 :: 后缀）
  │       统一入口：`-free` 后缀或硬编码免费集合（big-pickle）→ opencode (Zen) 服务商，否则 → opencode-go (Go) 服务商
  │       元数据合并链: MODEL_OVERRIDES > 目录 provider 条目 > 全局目录条目 > 保守默认值
  │
  ├── 2. 应用用户配置的 reasoningEffort
  │       ├── "disabled" → 关闭思考（always 模型除外）
  │       ├── "adaptive" → 开启思考，自动模式（发送 thinking: { type: "adaptive" }）
  │       ├── "enabled" → 开启思考，使用默认推理力度
  │       ├── "high"/"max" → 开启思考，指定推理力度
  │
  ├── 2b. 注入 temperature/top_p（模型预设或自定义设置）
  │       ├── preset 模式 → 注入预设的 temperature（不传入 top_p，由模型使用默认值）
  │       └── custom 模式 → 注入用户自定义的 temperature 和 top_p（如有设置）
  │
  ├── 2c. 注入 vision 配置
  │       └── modelConfig.vision = um?.vision ?? false
  │
  ├── 3. 确定 API 模式 (apiMode: "openai" | "openai-responses" | "anthropic")
  │       模型 provider.npm > 服务商 npm > 旧目录 family 兜底
  │
  ├── 4. 记录请求开始日志
  │
  ├── 5. 更新状态栏 Token 用量
  │
  ├── 6. 应用请求延迟 (delay)
  │
  ├── 7. 确保 API Key 存在
  │
  ├── 8. 创建请求超时 AbortController
  │      └── 连接 VS Code 取消令牌 → abort()
  │
  ├── 9. 创建 undici fetch (自定义 bodyTimeout)
  │
  ├── 9b. 获取 Response body reader 后，注册取消回调
  │      └── `token.onCancellationRequested` / `signal.addEventListener("abort")`
  │      └── 调用 `reader.cancel()` 立即中断流，使 `reader.read()` 返回 `{ done: true }`
  │
  │
  ├── 10. 根据 apiMode 路由:
  │
  │     ├── OpenAI 模式:
  │     │   ├── OpenaiApi.convertMessages()    ← 消息格式转换
  │     │   ├── OpenaiApi.prepareRequestBody()  ← 构建请求体
  │     │   ├── POST /chat/completions          ← 发送请求
  │     │   ├── executeWithRetry()              ← 可重试
  │     │   └── OpenaiApi.processStreamingResponse()
  │     │       ├── SSE 行解析 ("data: ...")
  │     │       ├── processDelta() → 处理每个 delta
  │     │       │   ├── 推理内容 (thinking/reasoning/reasoning_content)
  │     │       │   ├── XML think 块解析 (꽁...꽁)
  │     │       │   ├── 文本内容 → LanguageModelTextPart
  │     │       │   └── 工具调用 → LanguageModelToolCallPart
  │     │       └── 用量统计 (usage chunk)
  │     │
  │     └── Anthropic 模式:
  │         ├── AnthropicApi.convertMessages()   ← 消息格式转换
  │         ├── AnthropicApi.prepareRequestBody() ← 构建请求体
  │         ├── POST /v1/messages               ← 发送请求
  │         ├── executeWithRetry()               ← 可重试
  │         └── AnthropicApi.processStreamingResponse()
  │             ├── SSE 行解析 ("data: ...")
  │             └── processAnthropicChunk()
  │                 ├── content_block_start → 块开始
  │                 ├── content_block_delta → 增量内容
  │                 │   ├── text_delta      → 文本
  │                 │   ├── thinking_delta  → 推理
  │                 │   └── input_json_delta → 工具参数
  │                 └── content_block_stop/message_stop → 结束
  │
  ├── 11. 图片代理拦截处理:
  │       └── _handleInterceptedToolCall()
  │           ├── 检查 interceptedToolCall（循环，最多 visionMaxRounds 次）
  │           ├── 发出同一 thinking 块: "正在根据图片提问：[问题]" + 视觉模型流式输出
  │           ├── 调用 callVisionModel() 获取描述（可选实时转发文本到 thinking 块）
  │           ├── 关闭 thinking 块
  │           ├── 用户取消则跳过本轮
  │           ├── 创建独立 AbortController 用于本轮请求
  │           │   ├── 保留 temperature/reasoning_effort 等原始参数
  │           │   ├── Anthropic 模式额外恢复 system 和 thinking 配置
  │           │   └── DeepSeek 兼容注入 reasoning_content
  │           ├── 注入工具: 本轮注入 VS Code 原生工具 + ask_image（+ ask_with_multi_image 当 >=2 张图时）
  │           ├── 将完成的调用/结果写入 vision history DataPart
  │           └── 循环: 若模型再次调用 ask_image 则继续下一轮，无限追问
  │
  ├── 12. 错误处理:
  │        ├── 用户取消（token.isCancellationRequested）→ 直接重新抛出
  │        ├── 超时（abortController.signal.aborted）→ 友好超时提示
  │        ├── 连接被终止 → 友好终止提示
  │        └── 其他错误 → 原样抛出
  │
  └── 12. finally: 清理定时器, 记录请求结束日志
```

### 2.4 Thinking/推理内容处理

```
推理内容来源 (OpenAI 模式):
  ├── choice.thinking (对象/字符串)
  ├── delta.reasoning_content (字符串)
  ├── delta.reasoning (对象)
  ├── delta.thinking (对象)
  └── reasoning_details[] (OpenRouter 格式)
      ├── reasoning.summary → summary 字段
      ├── reasoning.text    → text 字段
      └── reasoning.encrypted → "[REDACTED]"

处理机制:
  1. bufferThinkingContent(text) → 积累到 _thinkingBuffer
  2. 每 100ms 定时刷新 → LanguageModelThinkingPart
  3. XML think 块 (꽁...꽁) → processXmlThinkBlocks()
  4. 文本内容出现时 → reportEndThinking()
```

### 2.5 工具调用处理

```
工具调用流 (OpenAI 模式):
  delta.tool_calls[]
    ├── index: 工具调用索引
    ├── id: 调用 ID
    ├── function.name: 函数名
    └── function.arguments: JSON 参数 (可能分片)

处理机制:
  1. _toolCallBuffers Map<index, {id, name, args}>
  2. stream 分片拼接 args
  3. tryEmitBufferedToolCall() → 参数可解析 JSON 时立即发射
  4. flushToolCallBuffers() → finish_reason 时强制发射剩余
  5. adjustReadFileParameters() → 自动扩增 read_file 行数
  ask_image 拦截: 不在 tryEmit/flush 中发出，改为设置 interceptedToolCall；视觉结果完成后由 provider 写入持久化 history DataPart
```

### 2.6 图片代理（ask_image Tool）流程

```
非视觉模型收到含图片的消息:
  │
  ├── 1. convertMessages()
  │      模型 vision=false，有 image → 替换为 "[The user sent an image (imageIndex=N)... I MUST call the ask_image tool...]"
  │      原图数据存入实例的 _localImages 数组
  │      同时递归扫描 tool result 内嵌的图片一并存入
  │      记录 _hasImages = true，保存 _originalApiMessages
  │
  ├── 2. prepareRequestBody()
  │      有 _localImages → 注入 ask_image 工具定义到 tools 列表
  │      设置 tool_choice = "auto"（DeepSeek 等模型拒绝强制 tool_choice）
  │
  ├── 3. 第一次 API 请求（含 ask_image + VS Code 原生工具）
  │      └── 模型自主决定是否调用 ask_image
  │
  ├── 4. processDelta() / processAnthropicChunk() 拦截
  │      ask_image 和 ask_with_multi_image 被缓存到 interceptedToolCall（不在 progress 中发出）
  │      tryEmitBufferedToolCall() 和 flushToolCallBuffers() 同时跳过 ask_image/ask_with_multi_image
  │
  └── 5. _handleInterceptedToolCall() 循环（多轮追问）
         for round = 1 to visionMaxRounds:
           ├── 读取 interceptedToolCall
           ├── 发出 LanguageModelThinkingPart("正在根据图片提问：[问题]\n...")
           ├── 使用模型的具体 query 调用 callVisionModel()，并将视觉模型文本流实时追加到同一 thinking 块
           │   └── 发送图片 + 查询到视觉模型，收集流式回答
           ├── 关闭 thinking
           ├── 通过 `application/vnd.opencodego.vision-tool-history+json` DataPart 持久化本轮 tool call + result
           ├── 构建本轮消息: 追加 assistant(tool_call) + tool(result)
           ├── 注入工具: VS Code 原生工具 + ask_image（两者共存）
           ├── 发送 API 请求并流式处理
           ├── 若模型再次调用 ask_image → 继续循环
           └── 若模型未调 ask_image → 结束
```

#### 多轮请求特点

- **支持无限追问**: 模型拿到图片描述后可以继续调用 ask_image 追问细节（最多 `visionMaxRounds` 次，默认 5）
- **工具共存**: 每轮同时注入 VS Code 原生工具（read_file 等）+ ask_image，模型可混合使用
- **图片数据生命周期**: 图片存于 API 实例的 `_localImages` 数组，请求结束后随实例 GC 自动回收；历史记录只持久化调用参数、结果和必要的 reasoning_content，不复制原始图片字节
- **跨轮工具历史**: `historyCodec.ts` 负责序列化/校验及 OpenAI Chat、OpenAI Responses、Anthropic 三种标准消息重建，`historyPart.ts` 负责 VS Code DataPart 的创建与解析；旧 history DataPart 在新请求中被消费，不会再次输出造成重复
- **OpenAI 模式**: 使用 `tool_calls` + `tool` role 消息格式构建每轮
- **OpenAI Responses 模式**: 使用 `function_call` + `function_call_output` input items 构建每轮，并以私有 DataPart 保存 `reasoning.encrypted_content`，支持 `store:false` 的无状态多轮请求
- **Anthropic 模式**: 使用 `tool_use` + `tool_result` content block 格式构建每轮
- **参数保留**: 每轮保留 temperature、top_p、thinking 模式等原始参数
- **DeepSeek 兼容**: 对 DeepSeek 模型的 assistant tool_call 消息注入 reasoning_content 字段

### 2.6 Git 提交消息生成流程

```
generateCommitMsg(secrets, scm?)
  ├── 检测 Git 扩展和仓库
  ├── 获取 Git Diff (gitUtils.getGitDiff)
  │   ├── 优先 staged diff (git diff --cached)
  │   └── 回退 unstaged diff (git diff)
  ├── 多仓库处理:
  │   ├── 0 个有变化的仓库 → 提示用户
  │   ├── 1 个 → 直接生成
  │   └── 多个 → QuickPick 选择
  ├── 构建 Prompt:
  │   ├── 系统提示词 (可自定义，强调直接输出不包含解释)
  │   ├── 最近提交风格参考
  │   │   ├── 默认: 仅提交标题 (git log --format=%s)
  │   │   └── 可选: 同时包含每次提交的 diff (opencodego.commitIncludeCommitDiff)
  │   ├── 语言检测: auto 模式时告知模型匹配历史 commit 语言风格
  │   ├── 用户当前输入 (SCM InputBox)
  │   └── Git Diff 内容
  ├── 调用 API:
  │   ├── 按 models.dev 的 apiMode 选择 OpenaiApi / ResponsesApi / AnthropicApi.createMessage()
  │   └── 流式输出到 SCM InputBox
  └── 清理: 移除 ``` 标记和 <think> 标签
```

---

## 3. 程序文件索引

### 3.1 目录结构

```
src/
├── apiModelList.ts                       # API 模型列表获取
├── goUsage.ts                            # Go 套餐用量拉取与缓存
├── commonApi.ts                          # API 抽象基类
├── extension.ts                          # 扩展入口 (activate/deactivate)
├── localize.ts                           # 国际化/本地化
├── logger.ts                             # 日志系统
├── modelOverrides.ts                     # 模型覆盖表（models.dev 无法表达的内容）
├── catalogModels.ts                      # 统一模型解析/构建层 (Go + Zen)
├── hardcodedModelList.ts                 # 硬编码兜底目录快照（官方目录与镜像均不可达时的最后防线）
├── modelsDev.ts                          # models.dev 目录拉取与查询
├── provideModel.ts                       # 模型信息提供函数（目录驱动）
├── provider.ts                           # Chat 模型提供商 (核心主文件)
├── provideToken.ts                       # Token 计数函数
├── statusBar.ts                          # 状态栏管理
├── types.ts                              # TypeScript 类型定义
├── utils.ts                              # 通用工具函数
├── versionManager.ts                     # 版本信息管理
├── openai/
│   ├── openaiApi.ts                      # OpenAI 兼容 API 实现
│   ├── openaiTypes.ts                    # OpenAI 类型定义
│   ├── responsesApi.ts                   # OpenAI Responses API 实现
│   ├── responsesState.ts                 # Responses 加密推理状态 DataPart 编解码
│   └── responsesTypes.ts                 # OpenAI Responses 类型定义
├── anthropic/
│   ├── anthropicApi.ts                   # Anthropic API 实现
│   └── anthropicTypes.ts                 # Anthropic 类型定义
├── gitCommit/
│   ├── commitMessageGenerator.ts         # Git 提交消息生成
│   └── gitUtils.ts                       # Git 工具函数
├── tokenizer/
│   ├── tokenizerManager.ts               # Tokenizer 管理 (o200k_base)
│   └── imageUtils.ts                     # 图片尺寸解析
├── vision/
│   ├── types.ts                          # Vision proxy 类型定义
│   ├── historyCodec.ts                   # 视觉工具历史序列化、校验和标准 API 消息重建
│   ├── historyPart.ts                    # VS Code vision history DataPart 创建与解析
│   └── imageProxy.ts                     # 图片代理核心 (ask_image)
└── resources/
    └── walkthrough/                      # 安装欢迎页 (Walkthrough) 文档
        ├── set-api-key.md                # 步骤 1：设置 API Key
        ├── set-api-key.nls.zh-cn.md      # 步骤 1 中文版
        ├── show-models.md                # 步骤 2：显示模型
        ├── show-models.nls.zh-cn.md      # 步骤 2 中文版
        ├── advanced-settings.md          # 步骤 3：高级设置
        └── advanced-settings.nls.zh-cn.md# 步骤 3 中文版
```

### 3.2 文件详细说明

| 文件                                  | 行数 | 职责                                                                                                                                                                                                   |
| ------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `extension.ts`                        | ~210 | 扩展激活/停用，注册 Provider 和 6 条命令，首次安装欢迎页引导                                                                                                                                           |
| `provider.ts`                         | ~900 | 实现 `LanguageModelChatProvider`，处理聊天请求全流程及图片代理多轮循环处理                                                                                                                             |
| `catalogModels.ts`                    | ~230 | 统一模型解析/构建层：`ModelMeta` 合并链（`MODEL_OVERRIDES` > 目录条目 > 默认值）、`buildCatalogModelInfo()`、`getCatalogModelConfig()`、`resolveProviderForModelId()`/`isZenFreeModelId()`（`-free` 后缀 + 硬编码集合分流 Zen/Go）           |
| `hardcodedModelList.ts`               | ~4880 | 硬编码兜底目录快照：opencode-go（24 个）与 opencode（85 个）模型的完整元数据（2026-08-04），官方目录与镜像均不可达时作为最后防线，与运行时 JSON 相同方式断言为 `HardcodedCatalogData`                             |
| `modelOverrides.ts`                   | ~50  | 每模型覆盖表 `MODEL_OVERRIDES`（全部可选字段）+ `ModelMetaOverride` 类型；仅维护 models.dev 无法表达的内容（Anthropic apiMode、adaptive、`reasoning_split` 等）                                             |
| `types.ts`                            | ~95  | `OpenCodeGoModelItem`, `ModelPreset`, `ModelsResponse`, `RetryConfig` 等类型                                                                                                                           |
| `apiModelList.ts`                     | ~110 | API 模型列表获取：从 catalog 解析的 base URL 的 `/models` 端点拉取可用模型 ID，1 分钟缓存，静默降级                                                                                                    |
| `goUsage.ts`                         | ~260 | Go 套餐用量拉取：从 `GET /zen/go/v1/usage` 拉取 5h/周/月窗口用量与 `useBalance`，5 分钟 TTL 缓存、失败保留旧值，宽容解析字段名（percent/usagePercent、resetsAt/resetInSec），格式化重置倒计时/摘要                                                                              |
| `modelsDev.ts`                        | ~440 | models.dev 目录拉取与查询：三级回退链（官方 → 镜像 → 硬编码列表），从 `catalog.json` 下载并索引全局模型与服务商，支持短 ID 匹配、provider 查询、`reasoning_options`/思考模式/视觉/预算推断，1 分钟缓存                                                                                                |
| `commonApi.ts`                        | ~467 | `CommonApi<TMessage,TRequestBody>` 抽象基类（图片存储、工具调用拦截、User-Agent 配置读取）                                                                                                             |
| `provideModel.ts`                     | ~180 | 模型信息提供函数：以 catalog 的 `opencode-go` provider 全量构建列表（可选按 API 列表过滤），Zen 免费模型从 `opencode` provider 按 `isZenFreeModelId()`（`-free` 后缀 + 硬编码 `big-pickle`）过滤；1 分钟间隔缓存与并发去重                                                                      |
| `provideToken.ts`                     | ~100 | Token 用量计算                                                                                                                                                                                         |
| `utils.ts`                            | ~490 | 工具函数（重试、角色映射、OpenAI Chat/Responses 工具格式转换等）                                                                                                                                       |
| `statusBar.ts`                        | ~317 | 状态栏创建、更新、累计计数器、Go 用量轮询与 tooltip 区块渲染                                                                                                                                           |
| `logger.ts`                           | ~55  | 日志输出 (LogOutputChannel)                                                                                                                                                                            |
| `localize.ts`                         | ~109 | 中英文国际化（含 `low/medium/high/xhigh/max` 思考强度标签）                                                                                                                                            |
| `versionManager.ts`                   | ~35  | 扩展版本信息（使用正确扩展 ID `OnesoftQwQ.opencode-go-copilot-provider`）                                                                                                                              |
| `openai/openaiApi.ts`                 | ~613 | OpenAI 格式 API 实现 (消息转换/请求构建/流式处理/图片代理)                                                                                                                                             |
| `openai/openaiTypes.ts`               | ~75  | OpenAI 类型定义                                                                                                                                                                                        |
| `openai/responsesApi.ts`              | ~410 | OpenAI Responses 格式 API 实现：typed input Items、扁平工具定义、请求参数映射、Responses SSE 文本/推理/工具/usage 解析                                                                                   |
| `openai/responsesState.ts`            | ~70  | 校验并编解码 `reasoning.encrypted_content` 私有 DataPart，使 `store:false` 的 Responses 推理模型可在后续请求中无状态续传                                                                               |
| `openai/responsesTypes.ts`            | ~125 | OpenAI Responses 请求、输入 Item、工具、usage 与流事件类型定义                                                                                                                                         |
| `anthropic/anthropicApi.ts`           | ~535 | Anthropic 格式 API 实现 (消息转换/请求构建/流式处理/图片代理)                                                                                                                                          |
| `anthropic/anthropicTypes.ts`         | ~130 | Anthropic 类型定义                                                                                                                                                                                     |
| `gitCommit/commitMessageGenerator.ts` | ~295 | Git 提交消息生成逻辑                                                                                                                                                                                   |
| `gitCommit/gitUtils.ts`               | ~260 | Git 命令封装                                                                                                                                                                                           |
| `tokenizer/tokenizerManager.ts`       | ~115 | o200k_base 分词器管理 (含 LRU 缓存)                                                                                                                                                                    |
| `tokenizer/imageUtils.ts`             | ~130 | 图片尺寸解析 (PNG/GIF/JPEG/WebP)                                                                                                                                                                       |
| `vision/types.ts`                     | ~53  | Vision proxy 类型定义（`StoredImage`, `InterceptedToolCall`, `ASK_IMAGE_TOOL_DEF`, `ASK_IMAGE_TOOL_NAME`, `ASK_WITH_MULTI_IMAGE_TOOL_DEF`, `ASK_WITH_MULTI_IMAGE_TOOL_NAME`, `DEFAULT_VISION_PROMPT`） |
| `vision/historyCodec.ts`              | ~170 | 视觉工具历史 DataPart 的 MIME、数据校验/编解码，以及 OpenAI Chat、OpenAI Responses、Anthropic 标准工具调用/结果重建；由 `scripts/test-vision-history.mjs` 做编解码和三 API 转换器顺序闭环测试（含无推理工具调用回合必须回传空 `reasoning_content` 的 DeepSeek 回归用例） |
| `vision/historyPart.ts`               | ~28  | 创建和解析 `application/vnd.opencodego.vision-tool-history+json` DataPart；测试脚本使用 VS Code 最小运行时桩验证下一轮消息转换                                                                         |
| `vision/imageProxy.ts`                | ~95  | 图片代理核心：调用视觉模型描述图片（`callVisionModel`/`callVisionModelMulti`），支持 thinking 模式配置和文本流式转发                                                                                   |

---

## 4. 函数定义大全

### 4.1 `src/extension.ts`

#### `activate(context: vscode.ExtensionContext): void`

扩展激活入口。初始化日志、分词器、状态栏；注册 `LanguageModelChatProvider`；注册七条命令（设置 API Key、获取 API Key 网址、打开扩展设置、生成 Git 提交消息、中止生成、设置模型预设、查询/刷新 Go 套餐用量）；激活时非阻塞预热模型发现（fire-and-forget 调用 `prepareLanguageModelChatInformation()`，每次激活刷新模型列表，先拉取 models.dev 目录再拉取模型列表，失败仅记录日志）；首次安装时调用 `showWelcomeIfNeeded()` 显示欢迎页引导。

#### `showWelcomeIfNeeded(context: vscode.ExtensionContext): Promise<void>`

检查是否已显示过欢迎页（通过 `globalState` 的 `WELCOME_SHOWN_KEY` 标记）。如果已标记或已有 API Key，直接返回；否则通过 `workbench.action.openWalkthrough` 命令打开 Walkthrough 页面并标记为已显示。静默处理异常，不阻塞扩展激活。

#### `deactivate(): void`

扩展停用。清理资源（日志 dispose）。

---

### 4.2 `src/provider.ts`

#### `class OpenCodeGoChatModelProvider implements LanguageModelChatProvider`

核心 Provider 类。

| 属性               | 类型             | 说明                           |
| ------------------ | ---------------- | ------------------------------ |
| `_lastRequestTime` | `number \| null` | 上次请求完成时间，用于延迟计算 |

#### `constructor(secrets: vscode.SecretStorage, statusBarItem: vscode.StatusBarItem)`

构造函数，接收密钥存储和状态栏条目。

#### `private _createFetchWithTimeout(requestTimeoutMs: number): typeof fetch`

创建 undici fetch 实例，设置自定义 `bodyTimeout` 防止流式响应中 TCP 空闲连接被提前关闭。回退到全局 `fetch`。

#### `provideLanguageModelChatInformation(options, _token): Promise<LanguageModelChatInformation[]>`

获取可用的语言模型列表。参数类型为 `PrepareLanguageModelChatModelOptions`，委托给 `prepareLanguageModelChatInformation()`。

#### `provideTokenCount(_model, text, _token): Promise<number>`

计算文本或消息的 Token 数量。委托给 `countMessageTokens()`。

#### `provideLanguageModelChatResponse(model, messages, options, progress, token): Promise<void>`

核心方法：处理聊天请求，流式返回响应。包括模型配置获取（统一 `getCatalogModelConfig`，按 `-free` 后缀 + 硬编码集合自动分流 Zen/Go）、API Key 验证、推理力度应用、temperature/top_p 注入（模型预设或自定义设置）、延迟控制、超时管理，以及按 `apiMode` 精确路由到 `/chat/completions`、`/responses`、`/v1/messages`。三种协议分别由 `OpenaiApi`、`ResponsesApi`、`AnthropicApi` 转换请求和解析流，之后统一处理图片代理拦截与错误。错误处理区分三种情况：用户取消（直接重新抛出原始错误）、超时（友好超时提示）、连接被终止（友好终止提示）。模型配置通过 `{ ...um }` 浅拷贝后再修改 thinking/temperature，防止并发会话间互相泄漏设置。

#### `private async _handleInterceptedToolCall(params): Promise<void>`

处理图片代理拦截。循环处理最多 `opencodego.visionMaxRounds` 轮（默认 5）。每轮检测 API 实例的 `interceptedToolCall`，发出 thinking 块显示“正在根据图片提问：[问题]”，关闭 thinking 块后视觉模型输出以普通文本流式显示，并立即输出一个 `application/vnd.opencodego.vision-tool-history+json` DataPart 保存调用 ID、参数、视觉结果和 OpenAI Chat 模式所需的 `reasoning_content`。单图调用 `callVisionModel()`，多图调用 `callVisionModelMulti()`，按当前协议追加工具调用与结果，注入 VS Code 原生工具 + ask_image（+ ask_with_multi_image 当 >=2 图时）供模型继续使用，保留 temperature/reasoning_effort 等原始参数；Responses 模式额外续传本轮捕获的 encrypted reasoning item。模型不再调用 ask_image/ask_with_multi_image 时退出循环。

- 视觉模型调用期间用户取消则跳过本轮。
- 每轮创建独立 AbortController，带独立超时。
- 每轮注入 VS Code 原生工具 + ask_image + ask_with_multi_image，确保模型可以混合使用。
- Anthropic 模式额外恢复 `system` 内容（`_systemContent`）和 `thinking` 参数。
- 第二轮及后续轮次请求体中显式设置 `tool_choice` 为 `"auto"`（OpenAI）或 `{ type: "auto" }`（Anthropic），确保模型可继续调用工具。
- Responses 模式的第二轮及后续请求继续使用 `store:false`、`/responses` 与扁平工具定义，并在 function call 前放回上一轮 encrypted reasoning item。
- 使用 `_resetStreamState()` 重置流状态，避免 `_completedToolCallIndices` 等状态在轮次间残留导致工具调用被跳过。
- `thinking` 字段值统一使用字符串（`"enabled"` / `"disabled"`），与 `prepareRequestBody` 保持一致。

#### `private async ensureApiKey(): Promise<string | undefined>`

确保 API Key 存在于 SecretStorage 中，缺失时弹出输入框提示用户输入。

#### Base URL HTTP 安全检查

在发送请求前验证 base URL：拒绝非 HTTP 协议；针对 `http:` 协议仅允许 localhost、127.0.0.1、::1、192.168.\*、10.\*、0.0.0.0 等本地/私有网络地址，远程端点强制使用 HTTPS。

---

### 4.3 `src/catalogModels.ts`

#### `interface ModelMeta`

解析后的模型元数据。models.dev 可提供的字段全部为**必选**（含保守默认值）：`displayName`、`vision`、`reasoning`、`supportsDisablingReasoning`、`thinkingMode`、`supportedReasoningEfforts`、`defaultReasoningEffort`、`contextLength`、`maxOutputTokens`、`apiMode`、`supportsTemperature`、`toolCalling`、`baseUrl`、`cost`；可选字段：`thinkingBudget`、`status`。

#### `isZenFreeModelId(modelId): boolean`

判断模型 ID 是否为 Zen 免费模型：`-free` 后缀约定，或在硬编码集合 `ZEN_FREE_EXTRA_IDS`（当前含 `big-pickle`）中。是 Zen/Go 分流的唯一依据。

#### `resolveProviderForModelId(modelId): "opencode-go" | "opencode"`

按模型 ID 分流服务商：`isZenFreeModelId()` 为真 → `opencode` (Zen)，否则 → `opencode-go` (Go)。是 Zen/Go 的唯一分流点。

#### `resolveModelMeta(providerId, modelId): ModelMeta`

统一合并链：`resolveFromCatalog()`（provider 条目 → 全局条目 → 保守默认值，逐字段兜底）后 `applyOverride()`（`MODEL_OVERRIDES[modelId]` 逐字段覆盖，写了的覆盖、没写的沿用）。

#### `buildCatalogModelInfo(providerId, modelId): LanguageModelChatInformation`

构建模型选择器条目。Zen 模型名前缀 `[Zen]`，deprecated 模型前缀 `[Depr]`。推理强度枚举由 `buildReasoningEnum()` 生成：`disabled` 档在前、`none`/`disabled` effort 值归一为 `禁用思考` 档（已由 `resolveFromCatalog` 过滤，避免重复档）；`defaultReasoningEffort` 不在枚举内时回退到最高档（如 adaptive 模型的 `enabled` → `adaptive`）。当模型为 Responses 原生协议且未声明关闭档位（`supportsDisablingReasoning=false`）时不注入 `disabled` 档，避免用户选择无效的禁用项。

#### `getCatalogModelConfig(modelId): OpenCodeGoModelItem`

构建请求配置（provider.ts 与 Git 提交生成共用）。含 `baseUrl`（取自服务商 `api` 字段）、`thinking_budget`（`budget_tokens` 的 max）、`reasoning_effort`（仅真实强度档，`enabled`/`adaptive` 不发送）、`extra`（仅覆盖表）。

### 4.3b `src/modelOverrides.ts`

#### `interface ModelMetaOverride`

每模型覆盖项，**全部字段可选**（写什么覆盖什么）。在 `ModelMeta` 基础上额外提供 models.dev 无法表达的字段：`extra`（请求体参数，如 `reasoning_split`）、`thinkingBudget`、`includeReasoningInRequest`。

#### `const MODEL_OVERRIDES: Record<string, ModelMetaOverride>`

覆盖表（当前 8 条）：`minimax-m3`（adaptive + anthropic + `reasoning_split`）、`minimax-m2.7`（anthropic + `reasoning_split`）、`minimax-m2.5`（anthropic）、`qwen3.7-max`/`qwen3.7-plus`/`qwen3.6-plus`/`qwen3.5-plus`（anthropic）、`glm-5.2`（默认 effort=high）。Zen 免费模型（`-free` 后缀）共用同一命名空间，需要时可在此追加。

---

### 4.4 `src/types.ts`

#### `interface OpenCodeGoModelItem`

完整模型配置接口。

| 属性                           | 类型                              | 说明                                      |
| ------------------------------ | --------------------------------- | ----------------------------------------- |
| `id`                           | `string`                          | 模型 ID                                   |
| `owned_by`                     | `string`                          | 提供商                                    |
| `configId`                     | `string` (可选)                   | 配置 ID（保留兼容）                       |
| `displayName`                  | `string` (可选)                   | 显示名称                                  |
| `baseUrl`                      | `string` (可选)                   | 自定义 Base URL                           |
| `context_length`               | `number` (可选)                   | 上下文长度                                |
| `vision`                       | `boolean` (可选)                  | 是否支持视觉                              |
| `max_completion_tokens`        | `number` (可选)                   | 最大输出 Token (新标准)                   |
| `reasoning_effort`             | `string` (可选)                   | 推理力度                                  |
| `enable_thinking`              | `boolean` (可选)                  | 是否启用 thinking                         |
| `thinking_budget`              | `number` (可选)                   | Thinking 预算 Token                       |
| `temperature`                  | `number \| null` (可选)           | 温度参数                                  |
| `top_p`                        | `number \| null` (可选)           | Top-p 采样                                |
| `top_k`                        | `number` (可选)                   | Top-k 采样                                |
| `min_p`                        | `number` (可选)                   | Min-p 采样                                |
| `frequency_penalty`            | `number` (可选)                   | 频率惩罚                                  |
| `presence_penalty`             | `number` (可选)                   | 存在惩罚                                  |
| `repetition_penalty`           | `number` (可选)                   | 重复惩罚                                  |
| `reasoning`                    | `object` (可选)                   | OpenRouter 推理配置                       |
| `extra`                        | `Record<string, unknown>` (可选)  | 额外请求体参数                            |
| `family`                       | `string` (可选)                   | 模型系列                                  |
| `include_reasoning_in_request` | `boolean` (可选)                  | 是否在请求中包含推理内容                  |
| `thinkingMode`                 | `"switchable" \| "always"` (可选) | 思考模式类型                              |
| `supportsTemperature`          | `boolean` (可选)                  | 是否支持设置 temperature/top_p，默认 true |
| `useForCommitGeneration`       | `boolean` (可选)                  | 是否用于提交消息生成                      |
| `delay`                        | `number` (可选)                   | 模型专属请求延迟                          |
| `apiMode`                      | `ApiMode` (可选)                  | API 模式：OpenAI Chat、Responses 或 Anthropic |
| `supportsDisablingReasoning`   | `boolean` (可选)                  | 目录是否声明 `none`/`disabled` effort 档；Responses 适配器据此决定能否发送 `reasoning.effort="none"` |
| `headers`                      | `Record<string, string>` (可选)   | 自定义 HTTP 头                            |

#### `interface ModelsResponse`

`{ object: string; data: ModelItem[] }` — 模型列表 API 响应。

#### `interface ModelItem`

`{ id, object?, created?, owned_by? }` — 单个模型条目。

#### `interface ModelPreset`

`{ id, label, temperature, top_p }` — 模型预设配置，用于快速切换温度和 top_p。

#### `interface RetryConfig`

`{ enabled, maxAttempts, intervalMs, backoffFactor, maxIntervalMs, statusCodes }` — 重试配置。

---

### 4.5 `src/commonApi.ts`

#### `interface StreamUsage`

`{ promptTokens, completionTokens, cacheHitTokens?, cacheMissTokens? }` — 流式用量信息。

#### `abstract class CommonApi<TMessage, TRequestBody>`

API 实现的抽象基类。

| 属性                          | 类型                                          | 说明                                    |
| ----------------------------- | --------------------------------------------- | --------------------------------------- |
| `_toolCallBuffers`            | `Map<number, {id?, name?, args}>`             | 工具调用参数缓冲区                      |
| `_completedToolCallIndices`   | `Set<number>`                                 | 已完成发射的工具调用索引                |
| `_hasEmittedAssistantText`    | `boolean`                                     | 是否已发射过助手文本                    |
| `_hasEmittedText`             | `boolean`                                     | 是否已发射过文本                        |
| `_hasEmittedThinking`         | `boolean`                                     | 是否已发射过推理内容                    |
| `_emittedBeginToolCallsHint`  | `boolean`                                     | 是否已发射工具调用前导空格              |
| `_xmlThinkActive`             | `boolean`                                     | XML think 块解析中                      |
| `_xmlThinkDetectionAttempted` | `boolean`                                     | 是否尝试过 XML think 检测               |
| `_currentThinkingId`          | `string \| null`                              | 当前推理内容 ID                         |
| `_thinkingBuffer`             | `string`                                      | 推理内容缓冲区                          |
| `_thinkingFlushTimer`         | `NodeJS.Timeout \| null`                      | 推理刷新定时器                          |
| `_systemContent`              | `string \| undefined`                         | 系统提示内容                            |
| `_modelId`                    | `string`                                      | 模型 ID                                 |
| `_onUsage`                    | `((usage: StreamUsage) => void) \| undefined` | 用量回调                                |
| `interceptedToolCall`         | `InterceptedToolCall \| null`                 | 被拦截的 ask_image 工具调用             |
| `_localImages`                | `StoredImage[]`                               | 实例局部图片数据，请求结束随 GC 回收    |
| `_originalApiMessages`        | `any[] \| null`                               | 转换后的原始 API 消息，用于构建多轮请求 |

#### `abstract convertMessages(messages, modelConfig): Promise<TMessage[]>`

将 VS Code 聊天消息转换为特定 API 格式的消息数组（**异步**，支持 MCP resource-link 图片解析）。modelConfig 新增 `vision` 字段，非视觉模型时自动替换图片为文本引用并存储图片数据。

#### `abstract prepareRequestBody(rb, um, options?): TRequestBody`

构建特定 API 的请求体。非视觉模型且存在图片时自动注入 `ask_image` 工具定义。

#### `abstract processStreamingResponse(responseBody, progress, token): Promise<void>`

处理特定 API 的流式响应。

#### `protected tryEmitBufferedToolCall(index, progress): Promise<void>`

当工具调用的名称和 JSON 参数都可用时，尝试发射缓冲的工具调用。跳过 `ask_image` 和 `ask_with_multi_image` 工具（由 provider 处理）。

#### `protected flushToolCallBuffers(progress, throwOnInvalid): Promise<void>`

清空所有工具调用缓冲区，发射剩余的工具调用。拦截 `ask_image` 和 `ask_with_multi_image` 存入 `interceptedToolCall`。

#### `public getStoredImage(imageIndex): StoredImage | undefined`

从实例的 `_localImages` 数组中按索引获取存储的图片数据。

#### `protected adjustReadFileParameters(toolName, parameters): Record<string, unknown>`

调整 `read_file` 工具的参数，根据配置自动扩增读取行数。

#### `protected _resetStreamState(): void`

重置可变流状态。必须在每次 `processStreamingResponse` 调用开始时调用，防止状态在轮次间残留（例如第一轮 → 视觉代理 → 第二轮）。清理内容包括：工具调用缓冲区、已发射索引、文本/推理发射标记、XML think 解析状态、thinking 缓冲区与定时器、被拦截工具调用。

#### `protected reportEndThinking(progress): void`

结束当前推理序列，向 VS Code 报告推理结束。

#### `protected generateThinkingId(): string`

生成唯一的推理内容 ID。

#### `protected bufferThinkingContent(text, progress): void`

缓冲推理内容，设置定时器每 100ms 刷新。

#### `protected flushThinkingBuffer(progress): void`

立即将缓冲的推理内容刷新到进度报告器。

#### `protected processXmlThinkBlocks(content, progress): { emittedAny: boolean }`

解析 XML think 块 (`꽁...꽁`)，将推理内容与文本内容分离。

#### `protected processTextContent(content, progress): { emittedAny: boolean }`

处理普通文本内容，发射到进度报告器。

#### `static prepareHeaders(apiKey, apiMode, customHeaders?): Record<string, string>`

准备 HTTP 请求头。读取 `OPENCODEGO_USER_AGENT` 环境变量覆盖 User-Agent（回退到 `VersionManager.getUserAgent()`；内部测试/应急用，非用户设置项）。Anthropic 模式使用 `x-api-key`，OpenAI 模式使用 `Bearer` 令牌。

---

### 4.6 `src/apiModelList.ts`

#### `getApiModelIds(apiKey): Promise<Set<string>>`

从 `/zen/go/v1/models` 拉取可用模型 ID 列表并返回 Set。使用内存缓存（1 分钟 TTL），API 不可用时返回空 Set 或上次缓存。内部 `fetchApiModelList()` 使用 10 秒 `AbortSignal.timeout(10000)`，超时后记录警告并抛出普通 `Error`（非 AbortError）以保留调用方缓存。导出 `isApiFetchSuccessful()` 检查上次请求是否成功。

#### `isApiFetchSuccessful(): boolean`

返回最近一次 API 模型列表拉取是否成功。用于模型提供者决定是否应用 API 过滤。

#### `clearApiModelCache(): void`

清除缓存的 API 模型 ID 列表和 `lastFetchSuccess` 状态。由 `resetAutoDiscoveryState()` 在强制刷新时调用，确保后续调用重新拉取最新模型列表。

---

### 4.7 `src/modelsDev.ts`

#### `interface ModelsDevEntry`

`{ id, name?, family?, reasoning?, tool_call?, structured_output?, temperature?, attachment?, modalities?, limit? }` — models.dev 数据库中单个模型条目的接口。

#### `ensureModelsDevLoaded(): Promise<void>`

从 `https://models.dev/catalog.json` 下载完整模型目录并构建内存索引（完整 ID → 条目 + 短 ID → 条目 + provider → 条目）。内部 `fetchCatalog()` 采用三级回退链：官方源（10 秒超时）→ 镜像（`opencodego.modelsDevMirrorUrl`，30 秒超时，携带 `platform: opencode-go-copilot` 与可选 `x-mirror-token` 请求头）→ 硬编码兜底目录快照（`HARDCODED_CATALOG`，含完整模型元数据与真实 provider `api`）。1 分钟缓存 TTL（短 TTL 兼作 VS Code 启动时多个并发 `activate()` 调用的去重窗口，同时保证每次激活/刷新均重新拉取目录）。镜像/兜底命中时 `lastLoadFailed=true`，按 1 分钟间隔持续重试官方源，官方恢复后自动切回；兜底命中且内存已有旧目录数据时保留旧数据（比硬编码列表更新），仅更新重试时机。失败时静默保留旧缓存，首次无缓存时初始化为空 Map。

#### `getMirrorConfig(): { url?: string; token?: string }`

读取 `opencodego.modelsDevMirrorUrl` / `opencodego.modelsDevMirrorToken` 设置，规范化镜像 URL（以 `/` 结尾时自动补 `catalog.json`），未配置时返回空对象。

#### `fetchJson(url, timeoutMs, headers?): Promise<{ data: CatalogData; bytes: number }>`

带超时的 JSON 拉取：`AbortSignal.timeout` 超时后记录 `modelsDev.fetch.timeout` 警告并抛出普通 `Error`（非 AbortError）以保留调用方缓存。返回解析后的目录及原始字节数（供日志统计）。

#### `logLoadSummary(source, start, data)`

目录加载汇总日志 `modelsDev.load`：记录最终来源（official/mirror/hardcoded/failed）、整条回退链耗时、providers 数与 Go/Zen 模型数；官方源命中为 info，回退源与失败为 warn 以便在输出面板中一眼定位。

#### `lookupModelDevEntry(apiModelId): ModelsDevEntry | undefined`

按 API 模型 ID 查找 models.dev 全局目录元数据。匹配策略：1) 完整 models.dev ID 精确匹配，2) 短 ID（斜杠后最后一段）匹配，3) 后缀匹配。

#### `getCatalogProvider(providerId): CatalogProvider | undefined`

按服务商 ID 获取目录条目（含 `api` URL、`env`、`npm`、`models`）。

#### `getCatalogProviderBaseUrl(providerId, fallbackUrl): string`

获取服务商 API 基础 URL（来自目录 `api` 字段，规范化去尾部斜杠并补 `/`）。目录未加载或服务商缺失时返回传入的 fallback。

#### `getCatalogProviderModelEntry(providerId, modelId): ModelsDevEntry | undefined`

获取服务商专属的模型条目（provider 条目优先于全局条目，含 `reasoning_options`、`interleaved`、`cost` 等）。

#### `getCatalogProviderModelIds(providerId): string[]`

获取服务商提供的全部模型 ID 列表（未加载时返回空数组）。

#### `inferThinkingMode(entry) / inferSupportsDisablingReasoning(entry) / inferReasoningEfforts(entry) / inferDefaultReasoningEffort(entry) / inferVision(entry) / inferThinkingBudget(entry)`

从目录条目推断：思考模式（`reasoning_options` 非空 → switchable，空但 `reasoning=true` → always；与 Chat/Anthropic 协议关闭思考的方式 `thinking` 标志解耦）、思考强度列表（`effort` 类型 values）、默认强度（最高档）、视觉能力（`attachment`/`modalities`）、思考预算（`budget_tokens` 的 min/max）。`inferSupportsDisablingReasoning()` 判断目录是否声明 `none`/`disabled` effort 档（或 toggle 型开关），**仅**由 Responses 协议适配器用于决定是否发送 `reasoning.effort="none"`：未声明关闭档位的 Responses 模型不发该值，避免端点拒绝；Chat/Anthropic 协议不受影响。

#### `clearModelsDevCache(): void`

清除缓存的 models.dev 目录数据（重置 `metadataMap`、`shortIdMap`、`providersMap`、`cacheTimestamp` 和 `lastLoadFailed`）。由 `resetAutoDiscoveryState()` 在强制刷新时调用，确保下次查询重新拉取最新目录。

#### `deduceApiModeFromCatalog(modelId, adapterNpm?, entry?)`

根据 `models.dev` 适配器包解析 API 格式：`@ai-sdk/openai` → `"openai-responses"`、`@ai-sdk/openai-compatible` → `"openai"`、`@ai-sdk/anthropic` → `"anthropic"`。调用方先选择模型级 `provider.npm`，缺失时继承服务商 `npm`；未识别或旧目录缺失适配器信息时才使用原 family 启发式兜底。由 `scripts/test-api-mode.mjs` 验证三协议映射和旧目录兼容行为。

---

### 4.10 `src/provideModel.ts`

#### `prepareLanguageModelChatInformation(options, _token, _secrets): Promise<LanguageModelChatInformation[]>`

获取模型信息列表。模型列表完全由 `models.dev` 目录驱动：`runCatalogPass()` 以 catalog 的 `opencode-go` provider 全量模型构建列表（可选按 API `/models` 列表过滤可用性；API 不可用时显示目录全量），Zen 免费模型由 `fetchZenFreeModelsCached()` 从 `opencode` provider 按 `isZenFreeModelId()` 过滤免费模型（`-free` 后缀 + 硬编码 `big-pickle`）构建并追加。刷新频率由 `opencodego.modelsDevUpdateInterval` 控制（默认 1 分钟）：该值充当限速器，去重 VS Code 启动时多个并发 `activate()` 调用产生的刷新，同时保证每次激活与超过间隔的模型选择器打开都会刷新。目录不可用（加载失败且无缓存）时返回空列表，待下次拉取恢复。扩展每次激活时由 `extension.ts` 非阻塞调用本函数预热刷新。

#### `runCatalogPass(secrets): Promise<LanguageModelChatInformation[] | null>`

目录加载失败时返回 null（保持旧缓存）；否则构建 Go 模型列表并记录 `models.discovery` 日志。

#### `fetchZenFreeModelsCached(token, updateInterval): Promise<LanguageModelChatInformation[]>`

从目录 `opencode` provider 按 `isZenFreeModelId()`（`-free` 后缀 + 硬编码 `big-pickle`）过滤构建 Zen 免费模型列表，带 1 分钟间隔缓存，失败时返回旧缓存或空数组。

#### `resetAutoDiscoveryState(): void`

重置所有缓存状态：清除 `cachedDiscoveredInfos`、`cachedZenInfos`、`isUpdatingModelsDev` 等内部状态，并调用 `clearApiModelCache()` 和 `clearModelsDevCache()` 一并清空 API 模型列表和 models.dev 目录缓存。由 `opencodego.updateModelList` 命令在强制刷新时调用。

---

### 4.7 `src/provideToken.ts`

#### `const BaseTokensPerMessage = 3`

每条消息的基础 Token 数。

#### `const BaseTokensPerName = 1`

每个名称的基础 Token 数。

#### `countMessageTokens(text, modelConfig): Promise<number>`

计算消息的总 Token 数。支持 `LanguageModelTextPart`、`LanguageModelDataPart`（图片/二进制）、`LanguageModelToolCallPart`、`LanguageModelToolResultPart`、`LanguageModelThinkingPart`；视觉历史和 Responses encrypted reasoning 两种私有 DataPart 只承担协议回放状态，不按普通二进制重复估算。

#### `textTokenLength(text): Promise<number>`

使用 tiktoken 分词器计算文本的 Token 数。

#### `countToolTokens(tools): Promise<number>`

计算工具定义的总 Token 数。

#### `calculateImageTokenCost(dataUrl): number`

基于图片尺寸计算 Token 成本。使用 512px 磁贴算法：基础 85 Token + 每磁贴 170 Token。

#### `calculateNonImageBinaryTokens(byteLength): number`

计算非图片二进制数据的 Token 成本（约 0.75 Token/字节）。

---

### 4.8 `src/utils.ts`

#### `interface ParsedModelId`

`{ baseId: string; configId?: string }` — 解析后的模型 ID。

#### `getModelProviderId(model): string`

从模型对象中提取提供商 ID，依次检查 `owned_by`、`provide`、`provider`、`ownedBy`、`owner`、`vendor` 字段。

#### `normalizeUserModels(models): OpenCodeGoModelItem[]`

规范化用户自定义模型列表，为每个模型设置 `owned_by` 字段。

#### `parseModelId(modelId): ParsedModelId`

解析模型 ID，按 `::` 分隔为 `baseId` 和 `configId`。

#### `mapRole(message): "user" | "assistant" | "system"`

将 VS Code 消息角色映射为字符串角色。

#### `convertToolsToOpenAI(options?): { tools?, tool_choice? }`

将 VS Code 工具定义转换为 OpenAI 函数工具定义。

#### `createRetryConfig(): RetryConfig`

从 VS Code 设置中读取重试配置。

#### `executeWithRetry<T>(fn, retryConfig): Promise<T>`

使用指数退避策略执行可重试的异步操作。

#### `isRetryableError(error, retryableStatusCodes): boolean`

判断错误是否可重试（网络错误 + 指定 HTTP 状态码）。

#### `isImageMimeType(mimeType): boolean`

判断 MIME 类型是否为图片。

#### `RESOURCE_LINK_MIME` / `isResourceLinkMimeType(mimeType): boolean`

MCP 工具结果 resource-link 的 MIME 类型常量 `application/vnd.code.resource-link` 及判断函数。MCP 服务器返回 `resource`/`resource_link` 类型（无内联 blob）的图片时，VS Code 以该 MIME 的 `LanguageModelDataPart`（内容为 JSON `{ uri, underlyingMimeType? }`）传入工具结果。

#### `parseResourceLinkData(data): ParsedResourceLink | null`

解析 MCP resource-link data part 的 JSON 载荷，返回 `{ uri, underlyingMimeType? }`，非法载荷返回 null。

#### `guessImageMimeTypeFromUri(uri): string | undefined`

从 resource URI 路径扩展名（`.png`/`.jpg`/`.gif`/`.webp`/`.bmp`）推断图片 MIME 类型。

#### `resolveResourceLinkToImage(data): Promise<{ data, mimeType } | null>`

解析 MCP resource-link data part 并尝试读取实际图片字节（通过 `vscode.workspace.fs.readFile` 读取 `vscode-chat-response-resource://` 等 URI，VS Code 为其注册了文件系统提供者，会话存活期间可读）。非图片或读取失败返回 null。

#### `createDataUrl(part): string`

从 `LanguageModelDataPart` 创建 Base64 Data URL。

#### `arrayBufferToBase64(buffer): string`

将 Uint8Array 转换为 Base64 字符串。

#### `isToolResultPart(part): boolean`

判断是否为 `LanguageModelToolResultPart`。

#### `collectToolResultText(part): string`

收集工具结果中的文本内容。

#### `tryParseJSONObject(text): { ok: true, value } | { ok: false }`

安全尝试解析 JSON 对象字符串。

---

### 4.22 `src/vision/types.ts`

#### `interface StoredImage`

`{ data: Uint8Array; mimeType: string }` — 存储的图片数据，用于 ask_image 工具。

#### `interface InterceptedToolCall`

`{ id: string; name: string; args: { imageIndex?: number; imageIndices?: number[]; query: string } }` — 被拦截的 ask_image 或 ask_with_multi_image 工具调用信息。`query` 是模型对图片的具体提问。`imageIndex` 用于单图，`imageIndices` 用于多图对比。

#### `const ASK_IMAGE_TOOL_DEF`

ask_image 工具定义的 OpenAI 格式（`type: "function"`），包含 `imageIndex` 和 `query` 参数签名。

#### `const ASK_IMAGE_TOOL_NAME`

`"ask_image"` — ask_image 工具名称常量。

#### `const ASK_WITH_MULTI_IMAGE_TOOL_DEF`

`ask_with_multi_image` 工具的 OpenAI 格式工具定义（`type: "function"`），包含 `imageIndices`（number[]）和 `query` 参数签名。支持多张图片的同时传入，模型可用此工具进行对比、差异分析等需要同时看多图的场景。

#### `const ASK_WITH_MULTI_IMAGE_TOOL_NAME`

`"ask_with_multi_image"` — ask_with_multi_image 工具名称常量。仅在 `_localImages.length >= 2` 时注入。

#### `const DEFAULT_VISION_PROMPT`

默认的图片分析提示词（未设置自定义查询时使用）。

---

### 4.23 `src/vision/imageProxy.ts`

#### `callVisionModel(imageData, mimeType, visionModelId, query, token, progress?): Promise<string>`

调用视觉模型回答关于图片的查询。使用 `vscode.lm.selectChatModels()` 查找模型，发送图片+查询文本，收集流式回答返回，并可通过 `progress` 实时转发 `LanguageModelTextPart`。与旧版 `describe_image` 不同，`query` 参数来自模型的 `ask_image` 工具调用，允许针对性提问（如"按钮是什么颜色？"）。支持 thinking 模式配置，通过 `opencodego.visionProxyThinking` 设置控制，开启时发送 `reasoning_effort="high"`，关闭时发送 `reasoning_effort="disabled"`。

#### `callVisionModelMulti(images, visionModelId, query, token, progress?): Promise<string>`

多图版本的视觉模型调用。将多张图片的 `LanguageModelDataPart` 和 query 文本放在同一条消息中发送给视觉模型，使其可以同时看到所有图片进行比较分析。支持流式输出转发。

---

### 4.24 `src/vision/historyCodec.ts`

#### `serializeVisionToolHistory(entry): Uint8Array` / `deserializeVisionToolHistory(data): VisionToolHistoryEntry | null`

将一个已完成的 `ask_image`/`ask_with_multi_image` 调用及视觉结果编码为可持久化 JSON，并在读取时严格校验版本、工具名、参数和结果字段。

#### `toOpenAIVisionToolMessages(entry): OpenAIChatMessage[]`

重建 OpenAI 标准 `assistant.tool_calls` + `tool` 消息，保留 DeepSeek 需要的 `reasoning_content`。

#### `toResponsesVisionToolItems(entry): ResponsesInputItem[]`

重建 OpenAI Responses 标准 `function_call` + `function_call_output` input items。

#### `toAnthropicVisionToolMessages(entry): AnthropicMessage[]`

重建 Anthropic 标准 `assistant.tool_use` + `user.tool_result` 消息。

---

### 4.25 `src/vision/historyPart.ts`

#### `createVisionToolHistoryPart(entry): vscode.LanguageModelDataPart`

创建专用 MIME 的响应 DataPart，使 VS Code 能将视觉工具历史带入下一轮上下文。

#### `parseVisionToolHistoryPart(part): VisionToolHistoryEntry | null`

识别并解析视觉工具历史 DataPart，忽略普通图片、usage 等其它 DataPart。

---

### 4.26 `src/goUsage.ts`

#### `type UsageFetchStatus`

`"ok" | "unauthorized" | "error"` — 最近一次用量拉取的结果。401 单独标记（有效 key 但无 Go 套餐）。

#### `interface GoUsageWindow`

`{ percent: number; resetsAt?: string }` — 单个用量窗口（rolling/weekly/monthly），percent 为 0-100 使用率，resetsAt 为 ISO 重置时间。

#### `interface GoUsageResult`

`{ rolling?; weekly?; monthly?; useBalance? }` — Go 套餐用量快照，窗口缺失时字段省略。

#### `parseWindow(raw): GoUsageWindow | undefined`

宽容解析单个窗口对象：接受 `percent`/`usagePercent`/`usage_percent` 与 `resetsAt`/`resetAt`（ISO 字符串）/`reset_in_sec`/`resets_in_seconds`（秒数转 ISO）字段变体；解析失败返回 undefined。

#### `fetchGoUsage(apiKey): Promise<GoUsageResult>`

从 `${baseUrl}/usage` 拉取用量（Bearer 认证，10 秒 `AbortSignal.timeout` 超时）。顶层结构宽容解包（`usage` / `windows` / 平铺字段均可）；非 2xx 时抛出带 `status` 属性的 Error（401 由调用方识别为无 Go 套餐）。日志：成功时输出 `goUsage.fetch.ok`（info，含 url/durationMs/各窗口百分比/useBalance），超时输出 `goUsage.fetch.timeout`（warn），JSON 解析失败输出 `goUsage.fetch.parseError`（error）。

#### `getGoUsageCached(apiKey, force?): Promise<GoUsageResult | null>`

获取用量：缓存新鲜（5 分钟 TTL）时直接返回；`force=true` 时绕过 TTL 强制拉取（显式刷新用）。失败时保留旧缓存并记录 `lastFetchStatus`（`ok`/`unauthorized`/`error`），静默降级。日志：每次失败恰好一条 warn——401 输出 `goUsage.fetch.unauthorized`（无 Go 套餐），其余输出 `goUsage.fetch.failed`（含 status/error）。

#### `getUsageSnapshot(): GoUsageResult | null`

同步读取缓存快照（状态栏 tooltip 渲染用，不触发拉取）。

#### `getUsageFetchStatus(): UsageFetchStatus`

最近一次拉取结果状态（供 checkUsage 命令区分 401 无套餐与一般失败）。

#### `formatResetDuration(iso): string`

将 ISO 重置时间格式化为紧凑倒计时（"2H13M"、"45M"）。

#### `formatUsageSummary(usage): string`

构建一行摘要（"5h: 65% · 7d: 30% · 30d: 12%"），供 checkUsage 命令的信息通知使用。

---

### 4.9 `src/statusBar.ts`

#### `initStatusBar(context, secrets): vscode.StatusBarItem`

创建状态栏条目（name 为 "Go Usage"），主文本初始为 "Go --"。设置条目 `command` 为 `opencodego.checkUsage`（点击条目即刷新用量）；保存 SecretStorage 引用并启动 Go 用量后台轮询（`startUsagePolling`），注册配置变化监听（`opencodego.showUsageInTooltip`/`opencodego.usageRefreshInterval` 变化时重启轮询并重渲染状态栏文本与 tooltip）与轮询定时器 dispose。

#### `isUsageTooltipEnabled(): boolean`

读取 `opencodego.showUsageInTooltip` 配置（默认 true），仅控制 tooltip 中的用量区块。

#### `getUsageRefreshIntervalMs(): number`

读取 `opencodego.usageRefreshInterval`（分钟）并夹取到 1-60，换算为毫秒。

#### `updateStatusBarGoUsageText(statusBarItem): void`

更新状态栏主文本为 5H 窗口用量（`$(symbol-numeric) Go 5H 65%`），无缓存数据时显示 `$(symbol-numeric) Go --`。（模块内使用）

#### `refreshGoUsage(): Promise<void>`

后台刷新 Go 用量（fire-and-forget）：无 API Key 或已有刷新在途时直接返回（无 key 时输出 `goUsage.poll.skip` debug 日志）；从 SecretStorage 读取 key 后调用 `getGoUsageCached()`，成功后重渲染状态栏文本与 tooltip。`usageRefreshInFlight` 标志防并发。

#### `stopUsagePolling() / startUsagePolling(): void`

停止/启动轮询定时器。轮询无条件启用（状态栏主文本依赖用量数据），`startUsagePolling` 先停旧定时器，立即触发一次刷新后按配置间隔定时刷新，输出 `goUsage.poll.start`/`goUsage.poll.stop`（debug，含 intervalMs）。

#### `formatTokenCount(value): string`

格式化 Token 数为人类可读格式 (K/M/B)（tooltip 渲染用）。

#### `updateContextStatusBar(messages, tools, statusBarItem, modelConfig): Promise<void>`

更新状态栏：主文本刷新为 Go 用量，tooltip 显示累计 Token 与用量区块。新对话时重置累计计数器。返回估算输入 Token 数（供 fallback usage）。

#### `updateStatusBarWithApiPrompt(statusBarItem): void`

API 返回用量数据后重渲染状态栏（主文本 = Go 用量，tooltip = 累计 Token）。

#### `resetCumulativeCounters(): void`

重置所有累计 Token 计数器（VS Code 启动和新对话时调用）。（模块内使用）

#### `recordUsage(usage: StreamUsage): void`

将流式用量累计到全局计数器。

#### `appendGoUsageTooltipLines(lines): void`

将 Go 套餐用量区块追加到 tooltip 行数组：配置关闭或无缓存时直接返回；存在至少一个窗口时每个窗口一行（`5H——65%` / `周——30%` / `月——12%`，标签与百分比之间用全角破折号 `——` 连接，无标题行无空行分隔）+ 5h 窗口重置倒计时行（"五小时窗口将在 2H13M 后重置"，`resetsAt` 缺失或解析失败时跳过）。

#### `updateCumulativeTooltip(statusBarItem): void`

更新状态栏工具提示：累计输入/输出 Token 数、缓存命中率，以及（启用且有缓存时）Go 套餐用量区块。

#### `refreshGoUsageNow(): Promise<GoUsageResult | null>`

强制立即刷新 Go 用量（`opencodego.checkUsage` 命令与点击状态栏使用）：调用 `getGoUsageCached(apiKey, true)` 绕过 TTL 强制拉取，完成后重渲染 tooltip 并返回结果。

---

### 4.10 `src/logger.ts`

#### `class Logger`

| 方法                       | 说明                                           |
| -------------------------- | ---------------------------------------------- |
| `init()`                   | 创建 VS Code `LogOutputChannel("OpenCodeGo")`  |
| `debug(tag, data)`         | 输出 DEBUG 级别日志                            |
| `info(tag, data)`          | 输出 INFO 级别日志                             |
| `warn(tag, data)`          | 输出 WARN 级别日志                             |
| `error(tag, data)`         | 输出 ERROR 级别日志                            |
| `sanitizeHeaders(headers)` | 脱敏敏感 HTTP 头 (Authorization, x-api-key 等) |
| `dispose()`                | 清理输出通道                                   |

#### `export const logger = new Logger()`

单例导出。

---

### 4.11 `src/localize.ts`

#### `l10n(key): string`

获取当前语言的本地化字符串。当前支持简体中文 (`zh-cn`)，回退到英文 key。

#### `l10nFormat(template, ...args): string`

格式化本地化字符串，替换 `{0}`, `{1}` 等占位符。

新增本地化键：

- `"Plain HTTP is only allowed for localhost or private network addresses. Use HTTPS for remote endpoints."` — Base URL 安全验证错误提示

---

### 4.12 `src/versionManager.ts`

#### `class VersionManager`

| 静态方法                                     | 说明                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `getVersion(): string`                       | 获取扩展版本号（从 `package.json` 读取，使用正确扩展 ID `OnesoftQwQ.opencode-go-copilot-provider` 而非旧值 `my-company.opencode-go-copilot`） |
| `getUserAgent(): string`                     | 构建 User-Agent 字符串（被 `CommonApi.prepareHeaders()` 用作回退 User-Agent）                                                                 |
| `getClientInfo(): { name, version, author }` | 获取客户端信息                                                                                                                                |

---

### 4.13 `src/openai/openaiTypes.ts`

#### `interface OpenAIToolCall`

`{ id, type: "function", function: { name, arguments } }` — OpenAI 工具调用。

#### `interface OpenAIFunctionToolDef`

`{ type: "function", function: { name, description?, parameters? } }` — OpenAI 函数工具定义。

#### `interface OpenAIChatMessage`

`{ role, content?, name?, tool_calls?, tool_call_id?, reasoning_content? }` — OpenAI 聊天消息。

#### `interface ChatMessageContent`

`{ type: "text" | "image_url", text?, image_url? }` — 多模态消息内容。

#### `type OpenAIChatRole`

`"system" | "user" | "assistant" | "tool"` — 聊天角色。

#### `interface ReasoningDetailCommon`

`{ id, format, index? }` — 推理详情公共接口。

#### `interface ReasoningSummaryDetail extends ReasoningDetailCommon`

`{ type: "reasoning.summary", summary }` — 推理摘要。

#### `interface ReasoningEncryptedDetail extends ReasoningDetailCommon`

`{ type: "reasoning.encrypted", data }` — 加密推理内容。

#### `interface ReasoningTextDetail extends ReasoningDetailCommon`

`{ type: "reasoning.text", text, signature? }` — 推理文本。

#### `type ReasoningDetail = ReasoningSummaryDetail | ReasoningEncryptedDetail | ReasoningTextDetail`

推理详情联合类型。

---

### 4.14 `src/openai/openaiApi.ts`

#### `class OpenaiApi extends CommonApi<OpenAIChatMessage, Record<string, unknown>>`

#### `constructor(modelId: string)`

构造函数，传入模型 ID。

#### `async convertMessages(messages, modelConfig): Promise<OpenAIChatMessage[]>`

将 VS Code 消息转换为 OpenAI 格式（**异步**）。支持文本、图片、工具调用、工具结果、推理内容的消息转换。modelConfig 新增 `vision` 字段，非视觉模型时自动替换图片为文本引用并存储图片数据；**视觉模型时保留工具结果（`LanguageModelToolResultPart`）内的图片 `LanguageModelDataPart`，转换为 `image_url` content 与文本合并为多模态 content 数组发送**（如内置 `view_image` 工具返回的图片）；**MCP 工具返回的 resource-link（`application/vnd.code.resource-link`）data part 会被解析并通过 `resolveResourceLinkToImage()` 读取为实际图片，视觉模型直接发送、非视觉模型存入 `_localImages` 供 `ask_image` 代理使用，解析失败时以文本形式提示 URI**。**`reasoning_content` 回传规则**：`includeReasoningInRequest` 为 true 时，assistant 消息只要携带推理内容**或工具调用**就设置 `reasoning_content`（无推理时为空字符串）——DeepSeek 思考模式要求携带 `tools` 参数的请求中，工具调用回合的 assistant 消息必须回传该字段（即使为空），缺失会在后续请求触发 400（`The reasoning_content in the thinking mode must be passed back to the API`）。

#### `prepareRequestBody(rb, um?, options?): Record<string, unknown>`

构建 OpenAI 请求体。设置 temperature、top_p、max_tokens、reasoning_effort（adaptive 模式时跳过）、thinking 模式（支持 `{ type: "enabled" }`、`{ type: "adaptive" }` 和关闭用 `{ type: false }`）、stop、tools、tool_choice 以及各种惩罚参数和 extra 参数。非视觉模型且存在图片时自动注入 `ask_image` 工具定义。Extra 参数合并前过滤保留键（`model`, `messages`, `stream`, `temperature`, `top_p`, `max_tokens`, `max_completion_tokens`, `tools`, `tool_choice`, `stop`, `reasoning_effort`, `thinking`, `top_k`, `min_p`, `frequency_penalty`, `presence_penalty`, `repetition_penalty`, `stream_options`, `reasoning` 等），冲突时 `logger.warn()` 记录。

#### `processStreamingResponse(responseBody, progress, token): Promise<void>`

处理 OpenAI SSE 流式响应。逐行解析 `data:` 前缀的 SSE 事件，处理 `[DONE]` 标记，解析 usage 用量信息，委托 `processDelta()`。注册取消回调：`token.onCancellationRequested` 时调用 `reader.cancel()` 立即中断流式读取。在 `finally` 块中 dispose 该回调，防止多次调用 `processStreamingResponse` 时回调累积。

#### `private processDelta(delta, progress): Promise<boolean>`

处理单个 stream delta。按序处理：推理内容 → XML think 块 → 文本内容 → 工具调用。支持 `reasoning_details` 数组（OpenRouter 格式）。

#### `async *createMessage(model, systemPrompt, messages, baseUrl, apiKey, signal?): AsyncGenerator<{ type: "text"; text: string }>`

非流式聊天消息生成器（用于 Git 提交生成）。发送 HTTP 请求后 yield 文本块。注册取消回调：`signal.addEventListener("abort")` 时调用 `reader.cancel()` 立即中断流。

---

### 4.14b `src/openai/responsesApi.ts`

#### `class ResponsesApi extends CommonApi<ResponsesInputItem, ResponsesRequestBody>`

独立的 OpenAI Responses 协议适配器。`convertMessages()` 将 VS Code 文本、图片、工具调用与工具结果转换为 typed input Items；工具结果图片使用 `function_call_output.output` 的 `input_text`/`input_image` 数组，并还原视觉历史及 encrypted reasoning 私有 DataPart。`prepareRequestBody()` 映射 `max_output_tokens`、`reasoning`、`include`、扁平 function tools（`strict:false`）及协议专属 extra 保留键；仅当模型声明支持（`supportsDisablingReasoning=true`）时才在禁用思考时发送 `reasoning.effort="none"`，否则省略 reasoning 控制并记录日志（模型按自身默认行为思考）。

#### `processStreamingResponse(responseBody, progress, token): Promise<void>`

解析 Responses SSE 类型事件：文本 delta、推理 delta、function call item/arguments、completed/incomplete/failed/error 与 usage。工具以 `output_index` 复用 `CommonApi` 缓冲和 `LanguageModelToolCallPart` 发射逻辑；完整 reasoning item 会被捕获并输出为 `application/vnd.opencodego.responses-reasoning+json` DataPart，供当前图片代理下一轮和未来会话轮次无状态续传；terminal failure 直接抛错而不是吞掉。由 `scripts/test-responses-api.mjs` 验证消息/图片/工具转换、请求体、跨 chunk SSE、工具单次发射、usage 映射与 encrypted reasoning 回放。

#### `takeCapturedReasoningItems(): ResponsesInputItem[]`

取出并清空最近一轮 Responses 流中捕获的 encrypted reasoning items，供 provider 在同一次图片代理循环的下一轮请求中放回。

#### `async *createMessage(model, systemPrompt, messages, baseUrl, apiKey, signal?): AsyncGenerator<{ type: "text"; text: string }>`

为 Git 提交消息生成发送 `store:false` 的 `/responses` 流式请求，使用顶层 `instructions` 和 typed input Items，并从 `response.output_text.delta` 逐块返回文本；失败事件直接抛错，取消时同步中止 reader。

### 4.14c `src/openai/responsesState.ts`

校验 Responses reasoning output item 的 `id`、`summary` 与 `encrypted_content`，并用专用 VS Code DataPart MIME 编解码，使 `store:false` 请求不依赖服务端保存响应状态。

### 4.14d `src/openai/responsesTypes.ts`

声明 Responses 的输入文本/图片、助手输出、reasoning、`function_call`、`function_call_output`、扁平工具、请求体、usage 与流事件类型。

---

### 4.15 `src/anthropic/anthropicTypes.ts`

#### `type AnthropicRole`

`"user" | "assistant"`

#### `interface AnthropicTextBlock`

`{ type: "text", text }` — 文本块。

#### `interface AnthropicImageBlock`

`{ type: "image", source: { type: "base64", media_type, data } }` — 图片块。

#### `interface AnthropicThinkingBlock`

`{ type: "thinking", thinking, signature? }` — 推理块。

#### `interface AnthropicToolUseBlock`

`{ type: "tool_use", id, name, input }` — 工具使用块。

#### `interface AnthropicToolResultBlock`

`{ type: "tool_result", tool_use_id, content, is_error? }` — 工具结果块。`content` 为字符串或 `(AnthropicTextBlock | AnthropicImageBlock)[]` 块数组（支持工具结果内嵌图片）。

#### `type AnthropicContentBlock`

文本 | 图片 | 推理 | 工具使用 | 工具结果的联合类型。

#### `interface AnthropicMessage`

`{ role, content: string | AnthropicContentBlock[] }` — Anthropic 消息。

#### `interface AnthropicRequestBody`

Anthropic 请求体。包含 `model`, `messages`, `max_tokens`, `system`, `stream`, `temperature`, `top_p`, `top_k`, `thinking`, `tools`, `tool_choice` 等字段。

#### `interface AnthropicToolDefinition`

`{ name, description?, input_schema? }` — Anthropic 工具定义。

#### `type AnthropicToolChoice`

`{ type: "auto" } | { type: "any" } | { type: "tool"; name } | { type: "none" }`

#### `interface AnthropicStreamChunk`

流式响应块的完整定义。包含 `type`（8 种事件类型）、`message`、`content_block`、`delta`、`usage`、`error` 等字段。

---

### 4.16 `src/anthropic/anthropicApi.ts`

#### `class AnthropicApi extends CommonApi<AnthropicMessage, AnthropicRequestBody>`

#### `constructor(modelId: string)`

构造函数，传入模型 ID。

#### `async convertMessages(messages, modelConfig): Promise<AnthropicMessage[]>`

将 VS Code 消息转换为 Anthropic 格式（**异步**）。系统消息提取到 `_systemContent`。支持文本、图片、工具使用、工具结果、推理内容。使用 `content` 块数组格式。modelConfig 新增 `vision` 字段，非视觉模型时自动替换图片为文本引用并存储图片数据；**视觉模型时保留工具结果内的图片 `LanguageModelDataPart`，转换为 `image` block（base64 source）与文本合并为 `tool_result` 块数组发送**（如内置 `view_image` 工具返回的图片）；**MCP 工具返回的 resource-link（`application/vnd.code.resource-link`）data part 会被解析并通过 `resolveResourceLinkToImage()` 读取为实际图片，视觉模型直接发送、非视觉模型存入 `_localImages` 供 `ask_image` 代理使用，解析失败时以文本形式提示 URI**。**多条工具结果合并**：Anthropic 协议要求一条 assistant `tool_use` 消息对应的所有 `tool_result` 必须放在紧随的同一条 user 消息中；VS Code 可能将每个工具结果作为独立消息传入（每条含一个 `LanguageModelToolResultPart`），转换器将连续出现的纯工具结果消息（无文本/图片/vision history）缓冲暂存，在遇到其他消息或消息列表末尾时合并为单条 user 消息（含全部 `tool_result` 块），避免 400 "tool_use ids were found without tool_result blocks immediately after" 错误（修复 issue #87）。由 `scripts/test-anthropic-tool-result-merge.mjs` 验证合并行为。

#### `prepareRequestBody(rb, um?, options?): AnthropicRequestBody`

构建 Anthropic 请求体。设置 max_tokens、system、temperature、top_p、top_k、thinking 模式（支持 `{ type: "enabled" }`、`{ type: "adaptive" }` 和 `{ type: "disabled" }`）、tools（转换为 Anthropic 格式）、tool_choice（auto/any/none）以及 extra 参数。非视觉模型且存在图片时自动注入 `ask_image` 工具定义。Extra 参数合并前过滤保留键（`model`, `messages`, `stream` 等），冲突时 `logger.warn()` 记录。

#### `processStreamingResponse(responseBody, progress, token): Promise<void>`

处理 Anthropic SSE 流式响应。逐行解析 `data:` 前缀的 SSE 事件，委托 `processAnthropicChunk()`。注册取消回调：`token.onCancellationRequested` 时调用 `reader.cancel()` 立即中断流式读取。在 `finally` 块中 dispose 该回调，防止多次调用 `processStreamingResponse` 时回调累积。

#### `private processAnthropicChunk(chunk, progress): Promise<void>`

处理 Anthropic 流式块。支持的事件类型：

- `ping` — 忽略
- `error` — 记录错误
- `message_start` — 消息元数据
- `message_delta` — 停止原因和用量
- `content_block_start` — 块开始（text/thinking/tool_use）
- `content_block_delta` — 增量内容（text_delta/thinking_delta/input_json_delta/signature_delta）
- `content_block_stop` / `message_stop` — 清空缓冲区

#### `async *createMessage(model, systemPrompt, messages, baseUrl, apiKey, signal?): AsyncGenerator<{ type: "text"; text: string }>`

非流式消息生成器（Anthropic 模式，用于 Git 提交生成）。注册取消回调：`signal.addEventListener("abort")` 时调用 `reader.cancel()` 立即中断流。

---

### 4.17 `src/gitCommit/commitMessageGenerator.ts`

#### `let commitGenerationAbortController: AbortController | undefined`

全局中止控制器。

#### `const DEFAULT_PROMPT`

默认提示词模板。包含 `system`（系统提示，强调直接输出 commit 信息、不包含任何前言和解释）、`user`（用户输入模板）、`styleReference`（风格参考模板，含语言匹配指令）。

#### `generateCommitMsg(secrets, scm?): Promise<void>`

入口函数。检测 Git 扩展和仓库，对多仓库场景进行选择，调用 `generateCommitMsgForRepository()`。

#### `orchestrateWorkspaceCommitMsgGeneration(secrets, repos): Promise<void>`

多仓库编排。筛选有变化的仓库，0/1/多仓库分别处理。

#### `filterForReposWithChanges(repos): Promise<any[]>`

筛选出有 Git 变更的仓库。

#### `promptRepoSelection(repos): Promise<any>`

弹出 QuickPick 让用户选择仓库（支持"全部生成"）。

#### `generateCommitMsgForRepository(secrets, repository): Promise<void>`

为单个仓库生成提交消息。显示进度条，支持取消。

#### `ensureApiKey(secrets): Promise<string | undefined>`

确保 API Key 存在。

#### `performCommitMsgGeneration(secrets, gitDiff, inputBox, repoPath?): Promise<void>`

核心生成逻辑。构建 prompt（含自定义提示词、最近提交风格、用户输入、diff 内容），支持 `auto` 语言模式（由模型根据历史 commit 风格自动推断），根据 catalog 的 `apiMode` 创建 OpenAI Chat、OpenAI Responses 或 Anthropic API 实例，流式输出提交消息到 InputBox。支持通过配置 `opencodego.commitIncludeCommitDiff` 控制风格参考中是否包含历史提交的实际代码变更（默认关闭）。支持通过配置 `opencodego.commitAttachContextFiles`（默认开启）控制是否将仓库根目录的 `AGENTS.md` 和 `README.md` 内容附加到 prompt 中作为额外上下文。在选择模型配置后浅拷贝（`{ ...config }`）再修改 `enable_thinking` 和 `max_completion_tokens`，防止对共享的自动发现配置缓存的突变；只有 catalog 声明 `none`/`disabled` 档位时才为提交生成关闭 reasoning。

#### `abortCommitGeneration(): void`

中止提交消息生成。

#### `extractCommitMessage(str): string`

从生成的文本中提取提交消息（移除代码块标记）。

#### `removeThinkTags(text): string`

移除文本中的 `<think>...</think>` 标签。

---

### 4.18 `src/gitCommit/gitUtils.ts`

#### `interface GitCommit`

`{ hash, shortHash, subject, author, date }` — Git 提交信息。

#### `checkGitRepo(cwd): Promise<boolean>`

检查当前目录是否为 Git 仓库。

#### `checkGitInstalled(): Promise<boolean>`

检查 Git 是否已安装。

#### `checkGitRepoHasCommits(cwd): Promise<boolean>`

检查 Git 仓库是否有提交记录。

#### `searchCommits(query, cwd): Promise<GitCommit[]>`

搜索 Git 提交记录（支持 hash 回退搜索）。

#### `getGitDiff(repoPath): Promise<string | undefined>`

获取 Git Diff。优先 staged diff (`git diff --cached`)，回退 unstaged diff (`git diff`)，使用 `-U1` 减少上下文行数，限制最多 500 行。

#### `interface GetRecentCommitsOptions`

`{ includeDiff?: boolean; maxDiffLinesPerCommit?: number }` — 获取最近提交的选项。

#### `getRecentCommits(repoPath, count, options?): Promise<string>`

获取最近的提交标题作为风格参考。可通过 `options.includeDiff` 启用包含每次提交的实际代码变更（diff），通过 `options.maxDiffLinesPerCommit` 控制每个提交 diff 的最大行数（默认 50）。diff 使用 `-U1` 减少上下文行数，避免两处改动之间夹杂不必要的未变更内容。

#### `limitDiffLines(diff, maxLines): string`

限制 diff 行数，超出时添加截断标记。

---

### 4.19 `src/tokenizer/tokenizerManager.ts`

#### `class TokenCache`

简单 LRU 缓存。

| 属性/方法         | 说明                                     |
| ----------------- | ---------------------------------------- |
| `cache`           | `Map<string, number>` — 缓存存储         |
| `maxSize`         | 最大条目数 (5000)                        |
| `maxSizeBytes`    | 最大字节数 (5MB)                         |
| `currentSize`     | 当前大小                                 |
| `get(key)`        | 获取缓存值，更新最近使用                 |
| `set(key, value)` | 设缓存值，超出限制时驱逐最久未使用的条目 |

#### `class TokenizerManager`

| 静态方法                    | 说明                   |
| --------------------------- | ---------------------- |
| `initialize(extensionPath)` | 设置扩展路径并获取单例 |
| `setExtensionPath(path)`    | 设置扩展路径           |
| `getInstance()`             | 获取单例实例           |

| 实例方法            | 说明                                         |
| ------------------- | -------------------------------------------- |
| `getTokenizer()`    | 获取或创建 tiktoken 分词器实例（o200k_base） |
| `countTokens(text)` | 使用缓存和分词器计算文本 Token 数            |

#### `export const tokenizerManager = TokenizerManager.getInstance()`

导出的单例实例。

---

### 4.20 `src/tokenizer/imageUtils.ts`

#### `getImageDimensions(base64): { width, height }`

从 Base64 图片字符串中获取尺寸。根据 MIME 类型分发到不同解析函数。

#### `getMimeType(base64): string`

通过读取文件头字节判断图片类型（JPEG/GIF/WebP/PNG）。

#### `getPngDimensions(base64): { width, height }`

解析 PNG 图片尺寸（读取 IHDR 块）。

#### `getGifDimensions(base64): { width, height }`

解析 GIF 图片尺寸（读取逻辑屏幕描述符）。

#### `getJpegDimensions(base64): { width, height }`

解析 JPEG 图片尺寸（扫描 SOF0/SOF1/SOF2 标记）。

#### `getWebPDimensions(base64String): { width, height }`

解析 WebP 图片尺寸（支持 VP8/VP8L/VP8X 格式）。

---

---

---

## 5. 编译与构建

### 5.1 编译命令

```bash
# TypeScript 编译
npm run compile
# 等效于: npx tsc -p ./

# ESLint 检查
npm run lint

# 仅类型检查（无输出）
npx tsc --noEmit

# 持续监视模式
npm run watch

# 手动刷新硬编码目录快照（发布构建自动执行）
node scripts/update-hardcoded-catalog.mjs

# 打包 VSIX
npm run build
# 等效于: npx @vscode/vsce package -o extension.vsix
```

### 5.2 编译配置 (tsconfig.json)

| 选项      | 值                  |
| --------- | ------------------- |
| `module`  | `Node16`            |
| `target`  | `ES2024`            |
| `lib`     | `["ES2024", "dom"]` |
| `strict`  | `true`              |
| `outDir`  | `out`               |
| `rootDir` | `src`               |

### 5.3 依赖

| 依赖                      | 版本     | 用途                           |
| ------------------------- | -------- | ------------------------------ |
| `@microsoft/tiktokenizer` | ^1.0.10  | o200k_base 分词器              |
| `@eslint/js`              | 9.39.4   | ESLint JavaScript 推荐规则     |
| `@types/node`             | ^22      | Node.js 类型定义               |
| `@types/vscode`           | ^1.116.0 | VS Code 类型定义               |
| `eslint`                  | 9.39.4   | 代码检查工具                   |
| `typescript`              | ^5.9.2   | TypeScript 编译器              |
| `typescript-eslint`       | 8.60.1   | TypeScript ESLint 配置与解析器 |

---

## 6. 开发规范

### 6.1 **编译检查铁律**

> **所有代码更改必须通过以下编译检查，确保无错误：**
>
> ```bash
> npm run compile
> # 或
> npx tsc --noEmit
> ```
>
> 任何编译错误（包括类型错误）必须在提交前修复。

### 6.2 **AGENTS.md 同步更新铁律**

> **每次代码更改后，必须同步更新 `AGENTS.md`，包括但不限于：**
>
> - 新增/修改/删除函数、类、接口 → 更新第 4 节（函数定义大全）
> - 新增/删除/重命名文件 → 更新第 3 节（程序文件索引）及第 3.2 节的目录结构和文件说明表
> - 新增/修改/删除模型定义 → 更新第 1.3 节（模型清单）
> - 修改核心逻辑流程 → 更新第 2 节（详细逻辑架构）中的流程图和文字描述
> - 修改编译配置、依赖、构建命令 → 更新第 5 节（编译与构建）
> - 修改开发规范 → 更新第 6 节（开发规范）
>
> 任何提交中若包含代码变更但未同步更新本文档，视为不合规。

### 6.3 PR 内容规范

> **当用户要求生成 PR (Pull Request) 内容时，必须遵循以下模板风格。**

#### PR Title 格式

使用 Conventional Commit 风格：

```
<type>: <brief description>
```

type 取值：`feat` | `fix` | `refactor` | `docs` | `chore` | `improve` 等。

#### PR Body 模板

```markdown
### Changes

**1. <功能/改动标题>**
- <具体变更点 1>
- <具体变更点 2>
- <...>

**2. <下一个功能/改动标题>**
- <具体变更点>
- <...>

### Files Changed

| File          | Change               |
| ------------- | -------------------- |
| `<file path>` | <一句话说明改了什么> |
| `<file path>` | <一句话说明改了什么> |
```

#### 撰写规范

- Title 首字母小写，用英文撰写
- Body 使用英文，用 **粗体标题** 组织 major change areas
- Changes 部分用项目符号列出每个功能点的具体变更，每点以句号结尾
- Files Changed 表格只列关键文件，说明简洁（不需要行数、路径全称）
- 不包含"如何测试"、"如何回滚"等运维内容，除非用户特别要求
- 语气精炼、直接，聚焦"改了什么"而非"为什么改"
- **从整体上审视**：按功能/模块组织内容，而非按 commit 罗列。将多个 commit 中属于同一功能点的更改合并描述，避免逐条罗列 commit 标题

### 6.4 更新日志内容规范

> **当用户要求生成基于 Git tag 的更新日志（Changelog）时，必须遵循以下格式风格。**

#### 格式模板

```markdown
### <功能/改动类别标题>

- **<具体功能/改动点标题>**：<详细描述，说明改了什么、为什么、影响范围等>
- **<下一个具体功能/改动点标题>**：<详细描述>
- <无标题的简单变更点直接用一句话描述>

### <下一个功能/改动类别标题>

- **<具体功能/改动点标题>**：<详细描述>
- <简单变更点>
```

#### 撰写规范

- 以 `###` 三级标题组织 major change areas，标题用中文，概括该类别下的所有变更
- 每个 change area 下列出具体变更点，用 `-` 项目符号
- 需要强调的变更点使用 `**<标题>**：<描述>` 格式，无需要强调的简单变更直接用一句话
- 描述应说明改了什么、为什么改（如有必要）、对用户的影响，聚焦"改了什么"而非罗列 commit 标题
- 用中文撰写，风格专业、精炼
- 不包含 `Files Changed` 表格或技术实现细节
- **按功能类别而非按 commit 时间组织**：从整体上审视 PR，将多个 commit 中属于同一功能领域的变更合并归类，避免逐条罗列 commit 标题

#### 示例

```markdown
### Git 提交消息生成增强

- **自动语言检测**：`opencodego.commitLanguage` 新增 `auto` 模式（默认）。启用后模型自动从仓库最近 10 条历史提交中推断使用的语言风格，无需手动指定目标语言。
- **历史提交代码变更参考**：新增配置项 `opencodego.commitIncludeCommitDiff`（默认关闭）。开启后模型在生成提交消息时会参考历史提交的实际代码变更，帮助模型更好地学习提交风格。
- **项目背景知识注入**：新增配置项 `opencodego.commitAttachContextFiles`（默认开启）。生成提交消息时自动将 AGENTS.md 和 README.md 内容附加到 prompt 中。

### Diff 生成优化

- **减少上下文行数**：将 diff 上下文从 3 行改为 1 行（`-U1`），避免大量未变更代码混入 prompt 中干扰模型。
```

### 6.5 代码风格

- 使用 TypeScript 严格模式 (`strict: true`)
- 遵循 ES2024 标准
- 使用 ESModule 模块系统 (`import`/`export`)
- 所有新的 API 函数需有 JSDoc 注释
- 导出的函数和类必须显式标注类型
- 使用 `satisfies` 操作符确保类型安全

### 6.6 命名约定

| 类别     | 约定             | 示例                                                |
| -------- | ---------------- | --------------------------------------------------- |
| 类       | PascalCase       | `OpenCodeGoChatModelProvider`                       |
| 接口     | PascalCase       | `BuiltInModelDef`, `OpenCodeGoModelItem`            |
| 类型     | PascalCase       | `OpenAIChatRole`, `ParsedModelId`                   |
| 函数     | camelCase        | `getCatalogModelConfig`, `countMessageTokens`       |
| 变量     | camelCase        | `requestTimeoutMs`, `apiKey`                        |
| 常量     | UPPER_SNAKE_CASE | `BASE_TOKENS_PER_MESSAGE`, `DEFAULT_CONTEXT_LENGTH` |
| 私有属性 | `_` 前缀         | `_lastRequestTime`, `_toolCallBuffers`              |
| 文件     | camelCase        | `provider.ts`, `commitMessageGenerator.ts`          |

### 6.7 VS Code API 使用约束

- `LanguageModelChatProvider` — 必须实现 `provideLanguageModelChatResponse()` 和 `provideLanguageModelChatInformation()`
- `LanguageModelResponsePart` — 使用 `LanguageModelTextPart`、`LanguageModelThinkingPart`、`LanguageModelToolCallPart`、`LanguageModelDataPart`
- `LanguageModelChatInformation.maxOutputTokens` — 必须填入模型真实输出上限，不能为 0；VS Code 原生 Token/Context Usage 指示器会在 `maxOutputTokens <= 0` 时隐藏
- `SecretStorage` — 用于安全存储 API Key
- `LogOutputChannel` — 用于结构化日志输出
- `Progress<LanguageModelResponsePart>` — 用于流式报告响应块

### 6.8 不依赖 VS Code Proposed API

- 本扩展不使用任何 `enabledApiProposals`，所有使用的 VS Code API 均为稳定版本（VS Code 1.116+）
- `LanguageModelChatProvider`、`LanguageModelDataPart`、`LanguageModelThinkingPart` 等类型均为 VS Code 稳定 API
- `languageModelDataPart.d.ts`、`chatProvider.d.ts`、`languageModelThinkingPart.d.ts` 等类型声明文件仅用于编译期类型补全，不影响运行时行为

### 6.9 错误处理策略

- 网络请求使用 `executeWithRetry()`（默认 3 次重试，指数退避）
- API 认证失败 → 弹出输入框提示用户输入
- 请求超时 → 友好的本地化错误消息
- 流式解析错误 → 记录日志，继续处理（不中断流）
- 所有未捕获错误由 `provider.ts` 的 `catch` 块统一处理

### 6.10 日志规范

所有日志使用 `logger` 单例，标签格式为 `category.subcategory`：

- `request.start/end` — 请求开始/结束
- `request.error/timeout/delay` — 请求错误/超时/延迟
- `extension.activate` — 扩展激活（含版本号）
- `models.loaded` — 模型加载
- `modelsDev.fetch.*` — 目录拉取明细：`fetch.official`/`fetch.mirror`（成功，含 durationMs/bytes）、`fetch.officialFailed`/`fetch.mirrorFailed`/`fetch.timeout`/`fetch.hardcoded`（失败或回退原因）
- `modelsDev.load` — 目录加载汇总（source/durationMs/providers/goModels/zenModels；官方源为 info，镜像/硬编码/失败为 warn）
- `goUsage.fetch.ok` — 用量拉取成功（info，含 url/durationMs/rolling/weekly/monthly/useBalance）
- `goUsage.fetch.timeout` — 用量拉取超时（warn）
- `goUsage.fetch.unauthorized` — 用量拉取 401，无有效 Go 套餐（warn）
- `goUsage.fetch.failed` — 用量拉取其他失败（warn，含 status/error）
- `goUsage.fetch.parseError` — 用量响应 JSON 解析失败（error）
- `goUsage.poll.start/stop/skip` — 状态栏用量轮询启停与跳过（debug）
- `commit.start/end/error` — 提交消息生成
- `openai.stream.*` / `anthropic.stream.*` — 流式处理
- `apiKey.missing` — API Key 缺失
