# 架构与功能说明

> 本文档描述 OpenCode Go Copilot Provider 的项目概况、核心能力与详细逻辑架构。开发规范见 [AGENTS.md](../AGENTS.md)，文件索引与函数定义见 [reference.md](reference.md)，编译构建见 [build.md](build.md)。

## 1. 项目介绍

### 1.1 概述

**OpenCode Go Copilot Provider** 是一个 VS Code 扩展，它将 OpenCode Go 平台的 AI 语言模型集成到 GitHub Copilot Chat 中。用户可以在 VS Code 的 Copilot Chat 界面中选择并使用 OpenCode Go 提供的各种模型（如 DeepSeek、GLM、Qwen、MiMo、MiniMax、Kimi 等系列），享受智能代码补全、聊天对话、Git 提交消息生成等功能。

### 1.2 核心能力

| 能力 | 说明 |
| --- | --- |
| **Chat 模型提供商** | 实现 `LanguageModelChatProvider` 接口，向 VS Code 注册为 `opencodego` 厂商 |
| **多模型支持** | 模型列表完全由 `models.dev` 目录驱动（`catalog.json` 的 `opencode-go` 服务商），覆盖 GLM、Kimi、DeepSeek、MiMo、MiniMax、Qwen 等全系列模型（含 gpt-5.6-luna、grok-4.5、hy3、qwen3.8-max 等新模型），统一通过推理强度选择器切换思考模式。可选开启 OpenCode Zen 免费模型（`opencode` 服务商，`-free` 后缀过滤 + 硬编码免费模型补充，见下）。元数据（上下文长度、视觉、思考模式、温度支持、API 端点等）全部自动获取，无需硬编码模型列表 |
| **自动模型发现** | 模型列表以 `models.dev` 目录为唯一数据源（1 分钟 TTL 缓存，兼作启动并发激活去重）。通过 `opencodego.enableAutoModelDiscovery` 配置（默认开启）控制是否从 `/zen/go/v1/models` 获取实际可用列表过滤模型选择器（不可用模型隐藏，API 不可用则显示目录全量）。服务商 URL、模型列表、参数（含 `reasoning_options` 思考强度）均从目录自动获取；API 不可用时目录不可用的降级为空列表，待下次拉取恢复 |
| **目录容灾回退** | 目录获取采用三级回退链：官方 `models.dev`（10 秒超时）→ 镜像（`opencodego.modelsDevMirrorUrl`，默认 `https://modelsdev-mirror.onesoft.top/catalog.json`，30 秒超时，请求头携带 `platform: opencode-go-copilot` 及可选 `x-mirror-token`）→ 硬编码兜底目录快照。镜像/兜底命中时按 1 分钟间隔持续重试官方源，官方恢复后自动切回 |
| **OpenCode Zen 免费模型** | 通过设置开关启用，从 `models.dev` 目录的 `opencode` 服务商获取模型列表并过滤出免费模型（`-free` 后缀约定 + 硬编码集合 `ZEN_FREE_EXTRA_IDS` 补充无后缀免费模型，如 `big-pickle`），以 `OpenCode Zen` 标识追加到模型选择器。元数据合并链与 Go 模型完全统一：`MODEL_OVERRIDES` > 目录条目 > 保守默认值。支持内存缓存（1 分钟 TTL） |
| **三 API 模式** | 根据 `models.dev` 的模型级 `provider.npm`（缺失时继承服务商 `npm`）区分 **OpenAI 兼容格式** (`/chat/completions`)、**OpenAI Responses 格式** (`/responses`) 和 **Anthropic 格式** (`/v1/messages`)；旧目录缺少适配器信息时才使用 family 启发式兜底 |
| **流式推理** | 支持 SSE (Server-Sent Events) 流式响应，实时输出文本和工具调用 |
| **Thinking/推理** | 支持模型的推理过程展示 ("thinking" 状态)，包括 XML think 块解析 |
| **工具调用 (Tool Calling)** | 支持 VS Code 的 LanguageModelToolCallPart 机制 |
| **图片代理 (Tool-based)** | 为不支持视觉的模型注入 `ask_image` 工具，模型可自主选择调用视觉模型（默认 Qwen3.6-Plus）回答关于图片的具体问题，支持多轮 API 请求完成"调用工具→提问→获取答案→继续回答"的完整流程。与旧版 `describe_image` 不同，`ask_image` 允许模型针对图片提出具体问题（如"按钮是什么颜色？"），视觉模型会针对性回答。每次内部视觉调用完成后还会输出专用 MIME 的 `LanguageModelDataPart`，下一轮从该记录重建标准 tool call + tool result，保持跨轮上下文。视觉模型 ID、查询提示词和思考模式均可通过设置配置；视觉代理会在同一个 thinking 块中显示"正在根据图片提问：[问题]"并实时追加视觉模型流式输出 |
| **MCP 工具图片支持** | 完整支持 MCP 工具（如 Chrome DevTools `take_screenshot`、photoshop-mcp 等）返回的图片：`type: image`/带 blob 的 `resource` 直接以图片 data part 接收；`resource`/`resource_link`（无 blob）则以 `application/vnd.code.resource-link` data part 接收，扩展会解析其中的 URI 并通过 `vscode.workspace.fs.readFile` 读取实际图片字节（VS Code 为 `vscode-chat-response-resource://` 注册了文件系统提供者）。视觉模型直接收到图片（image_url/image block），非视觉模型存入 `_localImages` 供 `ask_image` 代理使用；解析失败时以文本形式提示 URI |
| **Token 计数** | 使用 `o200k_base` tiktoken 分词器精确统计 token 用量 |
| **状态栏** | 实时显示当前会话 token 使用量、累计用量、缓存命中率 |
| **原生 Token 指示器** | 始终启用，向 Copilot Chat 原生 Token 指示器报告 token 用量。通过发送 MIME 类型为 `usage` 的 `LanguageModelDataPart`（TextEncoder 编码 JSON）实现，无需自建状态栏。依赖 VS Code/Copilot Chat 1.116+ 对外部模型 `usage` data part 的识别 |
| **高级 Token 指示器** | 可通过 `opencodego.enableThirdPartyTokenIndicator` 配置（默认开启）控制 VS Code 状态栏中的高级Token计数器。状态栏主文本显示 Go 套餐用量（见下），累计 Token 信息展示在悬停提示中。关闭后仅显示原生指示器 |
| **套餐用量监控** | 从官方用量端点 `GET /zen/go/v1/usage`（2026-08-11 上线，anomalyco/opencode#16513）拉取 Go 套餐用量：5 小时滚动 / 周 / 月三个窗口的使用率与重置时间，以及 `useBalance` 余额回退标志。状态栏主文本默认显示 5H 窗口用量（`$(symbol-numeric) Go 5H 65%`，无数据时 `Go --`）；悬停提示中展示三窗口明细与 5h 窗口重置倒计时（`opencodego.showUsageInTooltip` 控制 tooltip 区块，默认开启），后台按 `opencodego.usageRefreshInterval` 间隔轮询（默认 5 分钟，1-60 可调）；点击状态栏条目或运行 `opencodego.checkUsage` 命令可强制立即刷新并弹窗显示摘要。无 API Key 时不轮询，401（无 Go 套餐）与网络失败均静默降级、仅记录日志，响应字段名宽容解析（`percent`/`usagePercent`、`resetsAt`/`resetInSec` 双兼容） |
| **Git 提交消息生成** | 一键生成 Conventional Commit 格式的 Git 提交消息，支持 `auto` 语言模式自动从历史提交检测语言 |
| **多仓库支持** | 支持多根工作区 (multi-root) 中多个 Git 仓库的提交消息生成 |
| **模型预设** | 支持通过命令面板快速切换 temperature/top_p 预设（🎯 Precise/⚖️ Balanced/🔥 Creative），也支持手动自定义输入 |
| **国际化** | 内置简体中文 (zh-cn) 中英文双语界面 |
| **重试机制** | 可配置的指数退避重试策略，应对网络抖动和限流 (429) |
| **请求延迟** | 可配置的请求间隔延迟，避免触发 API 限流 |
| **超时控制** | 可配置的请求超时时间（默认 10 分钟） |
| **HTTP 安全检查** | 始终强制校验 Base URL：拒绝非 HTTP 协议；针对 `http:` 协议仅允许 localhost、127.0.0.1、::1、192.168.*、10.*、0.0.0.0 等本地/私有网络地址，远程端点强制使用 HTTPS |
| **立即取消** | 取消请求时通过 `reader.cancel()` 立即中断流式读取，停止后台接收 |
| **视觉代理配置** | 支持通过设置 `opencodego.visionProxyModel`、`opencodego.visionProxyThinking` 配置图片代理所使用的视觉模型和思考模式。`opencodego.visionProxyThinking` 默认关闭，关闭时内部请求通过 `modelOptions.thinking={ type: false }` / `reasoning_effort="disabled"` 禁用视觉模型思考，最终 OpenAI 兼容请求体发送 `thinking: { type: false }` |
| **安装欢迎页 (Walkthrough)** | 首次安装且未配置 API Key 时自动打开引导向导，指引用户设置 API Key 和打开语言模型管理器。包含 3 个步骤：设置 API Key、显示模型、高级设置。通过 `onStartupFinished` 激活事件确保在 VS Code 启动后立即检测 |

### 1.3 模型清单

> **模型列表 100% 由 `models.dev` 目录驱动**（`catalog.json`，1 分钟缓存）。模型 ID、显示名、上下文长度、输出上限、视觉能力、思考模式、思考强度、温度支持、API 端点 URL 均从目录自动获取，无内置硬编码模型列表。`src/modelOverrides.ts` 仅维护 models.dev 无法表达的少量覆盖项（如 Anthropic 格式的 apiMode、`reasoning_split` 参数）。

#### 模型来源

| 服务商 (Provider) | 来源 | 过滤规则 | 分组 (family) |
| --- | --- | --- | --- |
| `opencode-go`（OpenCode Go） | `catalog.json` → `providers["opencode-go"].models` | 可选按 API `/models` 列表过滤可用性 | `OpenCodeGo` |
| `opencode`（OpenCode Zen） | `catalog.json` → `providers["opencode"].models` | `-free` 后缀 + 硬编码集合（`big-pickle`） | `OpenCode Zen` |

> Go 服务商当前收录模型包括但不限于：`glm-5/5.1/5.2`、`kimi-k3/k2.5/k2.6/k2.7-code`、`deepseek-v4-pro/flash`、`mimo-v2-pro/omni/v2.5-pro/v2.5`、`minimax-m3/m2.7/m2.5`、`qwen3.5/3.6/3.7-plus`、`qwen3.7-max`、`qwen3.8-max`、`gpt-5.6-luna`、`grok-4.5`、`hy3` 等。实际显示取决于目录收录与 API 可用性。
> Zen 免费模型（`-free` 后缀）包括但不限于：`big-pickle`、`deepseek-v4-flash-free`、`minimax-m3-free`、`minimax-m2.5-free`、`ring-2.6-1t-free`、`nemotron-3-super-free` 等。
> 兜底快照：`src/hardcodedModelList.ts` 内置 2026-08-04 的官方目录快照，含 opencode-go（24 个）与 opencode（85 个，其中 22 个 `-free` 免费模型）的**完整模型元数据**（limit、cost、reasoning_options、attachment、modalities 等），仅作官方目录与镜像均不可达时的最后防线。发布构建（`.github/workflows/release.yml`）会先运行 `scripts/update-hardcoded-catalog.mjs` 自动刷新该快照（拉取官方目录 → 提取两个服务商 → 重写文件），失败时保留旧快照不阻断构建；数据有变化时随版本号变更在同一 commit 推送。

#### 思考强度自动推导（`reasoning_options`）

models.dev 目录通过 `reasoning_options` 字段提供每个模型的思考能力，映射规则：

| 目录数据 | 推导结果 | 示例 |
| --- | --- | --- |
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
│  │  用户发送消息 → LanguageModelChatProvider                      │  │
│  │                    ↓                                          │  │
│  │  OpenCodeGoChatModelProvider (provider.ts)                    │  │
│  │   1. 获取模型配置 (getCatalogModelConfig)                      │  │
│  │   2. 获取 API Key (SecretStorage)                             │  │
│  │   3. 计算 Token 用量 (provideToken → statusBar)                │  │
│  │   3b. 可选: 向 Copilot Chat 原生 Token 指示器报告用量           │  │
│  │       (LanguageModelDataPart, MIME type "usage", VS Code 1.116+)│  │
│  │   4. 应用请求延迟 (delay)                                     │  │
│  │   5. 构建请求 → API 路由选择                                  │  │
│  │      ├─ apiMode="openai"           → OpenaiApi                │  │
│  │      ├─ apiMode="openai-responses" → ResponsesApi             │  │
│  │      └─ apiMode="anthropic"        → AnthropicApi              │  │
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

### 2.7 Git 提交消息生成流程

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
