# 文件索引与函数定义

> 本文档为代码库参考手册：目录结构、文件职责与全部函数/类/接口定义。开发规范见 [AGENTS.md](../AGENTS.md)，架构说明见 [architecture.md](architecture.md)。

## 1. 程序文件索引

### 1.1 目录结构

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
└── vision/
    ├── types.ts                          # Vision proxy 类型定义
    ├── historyCodec.ts                   # 视觉工具历史序列化、校验和标准 API 消息重建
    ├── historyPart.ts                    # VS Code vision history DataPart 创建与解析
    └── imageProxy.ts                     # 图片代理核心 (ask_image)
```

### 1.2 文件详细说明

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `extension.ts` | ~210 | 扩展激活/停用，注册 Provider 和 7 条命令，首次安装欢迎页引导 |
| `provider.ts` | ~900 | 实现 `LanguageModelChatProvider`，处理聊天请求全流程及图片代理多轮循环处理 |
| `catalogModels.ts` | ~230 | 统一模型解析/构建层：`ModelMeta` 合并链（`MODEL_OVERRIDES` > 目录条目 > 默认值）、`buildCatalogModelInfo()`、`getCatalogModelConfig()`、`resolveProviderForModelId()`/`isZenFreeModelId()`（`-free` 后缀 + 硬编码集合分流 Zen/Go） |
| `hardcodedModelList.ts` | ~4880 | 硬编码兜底目录快照：opencode-go（24 个）与 opencode（85 个）模型的完整元数据（2026-08-04），官方目录与镜像均不可达时作为最后防线，与运行时 JSON 相同方式断言为 `HardcodedCatalogData` |
| `modelOverrides.ts` | ~50 | 每模型覆盖表 `MODEL_OVERRIDES`（全部可选字段）+ `ModelMetaOverride` 类型；仅维护 models.dev 无法表达的内容（Anthropic apiMode、adaptive、`reasoning_split` 等） |
| `types.ts` | ~95 | `OpenCodeGoModelItem`, `ModelPreset`, `ModelsResponse`, `RetryConfig` 等类型 |
| `apiModelList.ts` | ~110 | API 模型列表获取：从 catalog 解析的 base URL 的 `/models` 端点拉取可用模型 ID，1 分钟缓存，静默降级 |
| `goUsage.ts` | ~260 | Go 套餐用量拉取：从 `GET /zen/go/v1/usage` 拉取 5h/周/月窗口用量与 `useBalance`，5 分钟 TTL 缓存、失败保留旧值，宽容解析字段名（percent/usagePercent、resetsAt/resetInSec），格式化重置倒计时/摘要 |
| `modelsDev.ts` | ~440 | models.dev 目录拉取与查询：三级回退链（官方 → 镜像 → 硬编码列表），从 `catalog.json` 下载并索引全局模型与服务商，支持短 ID 匹配、provider 查询、`reasoning_options`/思考模式/视觉/预算推断，1 分钟缓存 |
| `commonApi.ts` | ~467 | `CommonApi<TMessage,TRequestBody>` 抽象基类（图片存储、工具调用拦截、User-Agent 配置读取） |
| `provideModel.ts` | ~180 | 模型信息提供函数：以 catalog 的 `opencode-go` provider 全量构建列表（可选按 API 列表过滤），Zen 免费模型从 `opencode` provider 按 `isZenFreeModelId()`（`-free` 后缀 + 硬编码 `big-pickle`）过滤；1 分钟间隔缓存与并发去重 |
| `provideToken.ts` | ~100 | Token 用量计算 |
| `utils.ts` | ~490 | 工具函数（重试、角色映射、OpenAI Chat/Responses 工具格式转换等） |
| `statusBar.ts` | ~317 | 状态栏创建、更新、累计计数器、Go 用量轮询与 tooltip 区块渲染 |
| `logger.ts` | ~55 | 日志输出 (LogOutputChannel) |
| `localize.ts` | ~109 | 中英文国际化（含 `low/medium/high/xhigh/max` 思考强度标签） |
| `versionManager.ts` | ~35 | 扩展版本信息（使用正确扩展 ID `OnesoftQwQ.opencode-go-copilot-provider`） |
| `openai/openaiApi.ts` | ~613 | OpenAI 格式 API 实现 (消息转换/请求构建/流式处理/图片代理) |
| `openai/openaiTypes.ts` | ~75 | OpenAI 类型定义 |
| `openai/responsesApi.ts` | ~410 | OpenAI Responses 格式 API 实现：typed input Items、扁平工具定义、请求参数映射、Responses SSE 文本/推理/工具/usage 解析 |
| `openai/responsesState.ts` | ~70 | 校验并编解码 `reasoning.encrypted_content` 私有 DataPart，使 `store:false` 的 Responses 推理模型可在后续请求中无状态续传 |
| `openai/responsesTypes.ts` | ~125 | OpenAI Responses 请求、输入 Item、工具、usage 与流事件类型定义 |
| `anthropic/anthropicApi.ts` | ~535 | Anthropic 格式 API 实现 (消息转换/请求构建/流式处理/图片代理) |
| `anthropic/anthropicTypes.ts` | ~130 | Anthropic 类型定义 |
| `gitCommit/commitMessageGenerator.ts` | ~295 | Git 提交消息生成逻辑 |
| `gitCommit/gitUtils.ts` | ~260 | Git 命令封装 |
| `tokenizer/tokenizerManager.ts` | ~115 | o200k_base 分词器管理 (含 LRU 缓存) |
| `tokenizer/imageUtils.ts` | ~130 | 图片尺寸解析 (PNG/GIF/JPEG/WebP) |
| `vision/types.ts` | ~53 | Vision proxy 类型定义（`StoredImage`, `InterceptedToolCall`, `ASK_IMAGE_TOOL_DEF`, `ASK_IMAGE_TOOL_NAME`, `ASK_WITH_MULTI_IMAGE_TOOL_DEF`, `ASK_WITH_MULTI_IMAGE_TOOL_NAME`, `DEFAULT_VISION_PROMPT`） |
| `vision/historyCodec.ts` | ~170 | 视觉工具历史 DataPart 的 MIME、数据校验/编解码，以及 OpenAI Chat、OpenAI Responses、Anthropic 标准工具调用/结果重建；由 `scripts/test-vision-history.mjs` 做编解码和三 API 转换器顺序闭环测试（含无推理工具调用回合必须回传空 `reasoning_content` 的 DeepSeek 回归用例） |
| `vision/historyPart.ts` | ~28 | 创建和解析 `application/vnd.opencodego.vision-tool-history+json` DataPart；测试脚本使用 VS Code 最小运行时桩验证下一轮消息转换 |
| `vision/imageProxy.ts` | ~95 | 图片代理核心：调用视觉模型描述图片（`callVisionModel`/`callVisionModelMulti`），支持 thinking 模式配置和文本流式转发 |

---

## 2. 函数定义大全

### 2.1 `src/extension.ts`

#### `activate(context: vscode.ExtensionContext): void`

扩展激活入口。初始化日志、分词器、状态栏；注册 `LanguageModelChatProvider`；注册七条命令（设置 API Key、获取 API Key 网址、打开扩展设置、生成 Git 提交消息、中止生成、设置模型预设、查询/刷新 Go 套餐用量）；激活时非阻塞预热模型发现（fire-and-forget 调用 `prepareLanguageModelChatInformation()`，每次激活刷新模型列表，先拉取 models.dev 目录再拉取模型列表，失败仅记录日志）；首次安装时调用 `showWelcomeIfNeeded()` 显示欢迎页引导。

#### `showWelcomeIfNeeded(context: vscode.ExtensionContext): Promise<void>`

检查是否已显示过欢迎页（通过 `globalState` 的 `WELCOME_SHOWN_KEY` 标记）。如果已标记或已有 API Key，直接返回；否则通过 `workbench.action.openWalkthrough` 命令打开 Walkthrough 页面并标记为已显示。静默处理异常，不阻塞扩展激活。

#### `deactivate(): void`

扩展停用。清理资源（日志 dispose）。

---

### 2.2 `src/provider.ts`

#### `class OpenCodeGoChatModelProvider implements LanguageModelChatProvider`

核心 Provider 类。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
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

处理图片代理拦截。循环处理最多 `opencodego.visionMaxRounds` 轮（默认 5）。每轮检测 API 实例的 `interceptedToolCall`，发出 thinking 块显示"正在根据图片提问：[问题]"，关闭 thinking 块后视觉模型输出以普通文本流式显示，并立即输出一个 `application/vnd.opencodego.vision-tool-history+json` DataPart 保存调用 ID、参数、视觉结果和 OpenAI Chat 模式所需的 `reasoning_content`。单图调用 `callVisionModel()`，多图调用 `callVisionModelMulti()`，按当前协议追加工具调用与结果，注入 VS Code 原生工具 + ask_image（+ ask_with_multi_image 当 >=2 图时）供模型继续使用，保留 temperature/reasoning_effort 等原始参数；Responses 模式额外续传本轮捕获的 encrypted reasoning item。模型不再调用 ask_image/ask_with_multi_image 时退出循环。

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

在发送请求前验证 base URL：拒绝非 HTTP 协议；针对 `http:` 协议仅允许 localhost、127.0.0.1、::1、192.168.*、10.*、0.0.0.0 等本地/私有网络地址，远程端点强制使用 HTTPS。

---

### 2.3 `src/catalogModels.ts`

#### `interface ModelMeta`

解析后的模型元数据。models.dev 可提供的字段全部为**必选**（含保守默认值）：`displayName`、`vision`、`reasoning`、`supportsDisablingReasoning`、`thinkingMode`、`supportedReasoningEfforts`、`defaultReasoningEffort`、`contextLength`、`maxOutputTokens`、`apiMode`、`supportsTemperature`、`toolCalling`、`baseUrl`、`cost`；可选字段：`thinkingBudget`、`status`。

#### `isZenFreeModelId(modelId): boolean`

判断模型 ID 是否为 Zen 免费模型：`-free` 后缀约定，或在硬编码集合 `ZEN_FREE_EXTRA_IDS`（当前含 `big-pickle`）中。是 Zen/Go 分流的唯一依据。

#### `resolveProviderForModelId(modelId): "opencode-go" | "opencode"`

按模型 ID 分流服务商：`isZenFreeModelId()` 为真 → `opencode` (Zen)，否则 → `opencode-go` (Go)。是 Zen/Go 的唯一分流点。

#### `resolveModelMeta(providerId, modelId): ModelMeta`

统一合并链：`resolveFromCatalog()`（provider 条目 → 全局条目 → 保守默认值，逐字段兜底）后 `applyOverride()`（`MODEL_OVERRIDES[modelId]` 逐字段覆盖，写了的覆盖、没写的沿用）。

#### `buildCatalogModelInfo(providerId, modelId): LanguageModelChatInformation`

构建模型选择器条目。模型名显式追加服务商后缀：Go 模型为 ` (Go)`，Zen 免费模型为 ` (Zen)`（deprecated 模型额外前缀 `[Depr]`）。Zen 模型 tooltip 额外提示「免费模型，可能会收集数据用于训练」。推理强度枚举由 `buildReasoningEnum()` 生成：`disabled` 档在前、`none`/`disabled` effort 值归一为 `禁用思考` 档（已由 `resolveFromCatalog` 过滤，避免重复档）；`defaultReasoningEffort` 不在枚举内时回退到最高档（如 adaptive 模型的 `enabled` → `adaptive`）。当模型为 Responses 原生协议且未声明关闭档位（`supportsDisablingReasoning=false`）时不注入 `disabled` 档，避免用户选择无效的禁用项。

#### `getCatalogModelConfig(modelId): OpenCodeGoModelItem`

构建请求配置（provider.ts 与 Git 提交生成共用）。含 `baseUrl`（取自服务商 `api` 字段）、`thinking_budget`（`budget_tokens` 的 max）、`reasoning_effort`（仅真实强度档，`enabled`/`adaptive` 不发送）、`extra`（仅覆盖表）。

### 2.4 `src/modelOverrides.ts`

#### `interface ModelMetaOverride`

每模型覆盖项，**全部字段可选**（写什么覆盖什么）。在 `ModelMeta` 基础上额外提供 models.dev 无法表达的字段：`extra`（请求体参数，如 `reasoning_split`）、`thinkingBudget`、`includeReasoningInRequest`。

#### `const MODEL_OVERRIDES: Record<string, ModelMetaOverride>`

覆盖表（当前 8 条）：`minimax-m3`（adaptive + anthropic + `reasoning_split`）、`minimax-m2.7`（anthropic + `reasoning_split`）、`minimax-m2.5`（anthropic）、`qwen3.7-max`/`qwen3.7-plus`/`qwen3.6-plus`/`qwen3.5-plus`（anthropic）、`glm-5.2`（默认 effort=high）。Zen 免费模型（`-free` 后缀）共用同一命名空间，需要时可在此追加。

---

### 2.5 `src/types.ts`

#### `interface OpenCodeGoModelItem`

完整模型配置接口。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 模型 ID |
| `owned_by` | `string` | 提供商 |
| `configId` | `string` (可选) | 配置 ID（保留兼容） |
| `displayName` | `string` (可选) | 显示名称 |
| `baseUrl` | `string` (可选) | 自定义 Base URL |
| `context_length` | `number` (可选) | 上下文长度 |
| `vision` | `boolean` (可选) | 是否支持视觉 |
| `max_completion_tokens` | `number` (可选) | 最大输出 Token (新标准) |
| `reasoning_effort` | `string` (可选) | 推理力度 |
| `enable_thinking` | `boolean` (可选) | 是否启用 thinking |
| `thinking_budget` | `number` (可选) | Thinking 预算 Token |
| `temperature` | `number \| null` (可选) | 温度参数 |
| `top_p` | `number \| null` (可选) | Top-p 采样 |
| `top_k` | `number` (可选) | Top-k 采样 |
| `min_p` | `number` (可选) | Min-p 采样 |
| `frequency_penalty` | `number` (可选) | 频率惩罚 |
| `presence_penalty` | `number` (可选) | 存在惩罚 |
| `repetition_penalty` | `number` (可选) | 重复惩罚 |
| `reasoning` | `object` (可选) | OpenRouter 推理配置 |
| `extra` | `Record<string, unknown>` (可选) | 额外请求体参数 |
| `family` | `string` (可选) | 模型系列 |
| `include_reasoning_in_request` | `boolean` (可选) | 是否在请求中包含推理内容 |
| `thinkingMode` | `"switchable" \| "always"` (可选) | 思考模式类型 |
| `supportsTemperature` | `boolean` (可选) | 是否支持设置 temperature/top_p，默认 true |
| `useForCommitGeneration` | `boolean` (可选) | 是否用于提交消息生成 |
| `delay` | `number` (可选) | 模型专属请求延迟 |
| `apiMode` | `ApiMode` (可选) | API 模式：OpenAI Chat、Responses 或 Anthropic |
| `supportsDisablingReasoning` | `boolean` (可选) | 目录是否声明 `none`/`disabled` effort 档；Responses 适配器据此决定能否发送 `reasoning.effort="none"` |
| `headers` | `Record<string, string>` (可选) | 自定义 HTTP 头 |

#### `interface ModelsResponse`

`{ object: string; data: ModelItem[] }` — 模型列表 API 响应。

#### `interface ModelItem`

`{ id, object?, created?, owned_by? }` — 单个模型条目。

#### `interface ModelPreset`

`{ id, label, temperature, top_p }` — 模型预设配置，用于快速切换温度和 top_p。

#### `interface RetryConfig`

`{ enabled, maxAttempts, intervalMs, backoffFactor, maxIntervalMs, statusCodes }` — 重试配置。

---

### 2.6 `src/commonApi.ts`

#### `interface StreamUsage`

`{ promptTokens, completionTokens, cacheHitTokens?, cacheMissTokens? }` — 流式用量信息。

#### `abstract class CommonApi<TMessage, TRequestBody>`

API 实现的抽象基类。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `_toolCallBuffers` | `Map<number, {id?, name?, args}>` | 工具调用参数缓冲区 |
| `_completedToolCallIndices` | `Set<number>` | 已完成发射的工具调用索引 |
| `_hasEmittedAssistantText` | `boolean` | 是否已发射过助手文本 |
| `_hasEmittedText` | `boolean` | 是否已发射过文本 |
| `_hasEmittedThinking` | `boolean` | 是否已发射过推理内容 |
| `_emittedBeginToolCallsHint` | `boolean` | 是否已发射工具调用前导空格 |
| `_xmlThinkActive` | `boolean` | XML think 块解析中 |
| `_xmlThinkDetectionAttempted` | `boolean` | 是否尝试过 XML think 检测 |
| `_currentThinkingId` | `string \| null` | 当前推理内容 ID |
| `_thinkingBuffer` | `string` | 推理内容缓冲区 |
| `_thinkingFlushTimer` | `NodeJS.Timeout \| null` | 推理刷新定时器 |
| `_systemContent` | `string \| undefined` | 系统提示内容 |
| `_modelId` | `string` | 模型 ID |
| `_onUsage` | `((usage: StreamUsage) => void) \| undefined` | 用量回调 |
| `interceptedToolCall` | `InterceptedToolCall \| null` | 被拦截的 ask_image 工具调用 |
| `_localImages` | `StoredImage[]` | 实例局部图片数据，请求结束随 GC 回收 |
| `_originalApiMessages` | `any[] \| null` | 转换后的原始 API 消息，用于构建多轮请求 |

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

### 2.7 `src/apiModelList.ts`

#### `getApiModelIds(apiKey): Promise<Set<string>>`

从 `/zen/go/v1/models` 拉取可用模型 ID 列表并返回 Set。使用内存缓存（1 分钟 TTL），API 不可用时返回空 Set 或上次缓存。内部 `fetchApiModelList()` 使用 10 秒 `AbortSignal.timeout(10000)`，超时后记录警告并抛出普通 `Error`（非 AbortError）以保留调用方缓存。导出 `isApiFetchSuccessful()` 检查上次请求是否成功。

#### `isApiFetchSuccessful(): boolean`

返回最近一次 API 模型列表拉取是否成功。用于模型提供者决定是否应用 API 过滤。

#### `clearApiModelCache(): void`

清除缓存的 API 模型 ID 列表和 `lastFetchSuccess` 状态。由 `resetAutoDiscoveryState()` 在强制刷新时调用，确保后续调用重新拉取最新模型列表。

---

### 2.8 `src/modelsDev.ts`

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

### 2.9 `src/provideModel.ts`

#### `prepareLanguageModelChatInformation(options, _token, _secrets): Promise<LanguageModelChatInformation[]>`

获取模型信息列表。模型列表完全由 `models.dev` 目录驱动：`runCatalogPass()` 以 catalog 的 `opencode-go` provider 全量模型构建列表（可选按 API `/models` 列表过滤可用性；API 不可用时显示目录全量），**并额外按 `resolveProviderForModelId()` 过滤，仅保留路由到 Go 的模型**（避免 `-free` 后缀的目录条目被错误放入 Go 选择器、选中后 401 路由到 Zen 端点），Zen 免费模型由 `fetchZenFreeModelsCached()` 从 `opencode` provider 按 `isZenFreeModelId()` 过滤免费模型（`-free` 后缀 + 硬编码 `big-pickle`）构建并追加。刷新频率由 `opencodego.modelsDevUpdateInterval` 控制（默认 1 分钟）：该值充当限速器，去重 VS Code 启动时多个并发 `activate()` 调用产生的刷新，同时保证每次激活与超过间隔的模型选择器打开都会刷新。目录不可用（加载失败且无缓存）时返回空列表，待下次拉取恢复。扩展每次激活时由 `extension.ts` 非阻塞调用本函数预热刷新。

#### `runCatalogPass(secrets): Promise<LanguageModelChatInformation[] | null>`

目录加载失败时返回 null（保持旧缓存）；否则构建 Go 模型列表（额外按 `resolveProviderForModelId()` 过滤，丢弃会被路由到 Zen 的 `-free` 后缀条目，如 `ox-alpha-free`），并记录 `models.discovery` 日志。

#### `fetchZenFreeModelsCached(token, updateInterval): Promise<LanguageModelChatInformation[]>`

从目录 `opencode` provider 按 `isZenFreeModelId()`（`-free` 后缀 + 硬编码 `big-pickle`）过滤构建 Zen 免费模型列表，带 1 分钟间隔缓存，失败时返回旧缓存或空数组。

#### `resetAutoDiscoveryState(): void`

重置所有缓存状态：清除 `cachedDiscoveredInfos`、`cachedZenInfos`、`isUpdatingModelsDev` 等内部状态，并调用 `clearApiModelCache()` 和 `clearModelsDevCache()` 一并清空 API 模型列表和 models.dev 目录缓存。由 `opencodego.updateModelList` 命令在强制刷新时调用。

---

### 2.10 `src/provideToken.ts`

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

### 2.11 `src/utils.ts`

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

### 2.12 `src/vision/types.ts`

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

### 2.13 `src/vision/imageProxy.ts`

#### `callVisionModel(imageData, mimeType, visionModelId, query, token, progress?): Promise<string>`

调用视觉模型回答关于图片的查询。使用 `vscode.lm.selectChatModels()` 查找模型，发送图片+查询文本，收集流式回答返回，并可通过 `progress` 实时转发 `LanguageModelTextPart`。与旧版 `describe_image` 不同，`query` 参数来自模型的 `ask_image` 工具调用，允许针对性提问（如"按钮是什么颜色？"）。支持 thinking 模式配置，通过 `opencodego.visionProxyThinking` 设置控制，开启时发送 `reasoning_effort="high"`，关闭时发送 `reasoning_effort="disabled"`。

#### `callVisionModelMulti(images, visionModelId, query, token, progress?): Promise<string>`

多图版本的视觉模型调用。将多张图片的 `LanguageModelDataPart` 和 query 文本放在同一条消息中发送给视觉模型，使其可以同时看到所有图片进行比较分析。支持流式输出转发。

---

### 2.14 `src/vision/historyCodec.ts`

#### `serializeVisionToolHistory(entry): Uint8Array` / `deserializeVisionToolHistory(data): VisionToolHistoryEntry | null`

将一个已完成的 `ask_image`/`ask_with_multi_image` 调用及视觉结果编码为可持久化 JSON，并在读取时严格校验版本、工具名、参数和结果字段。

#### `toOpenAIVisionToolMessages(entry): OpenAIChatMessage[]`

重建 OpenAI 标准 `assistant.tool_calls` + `tool` 消息，保留 DeepSeek 需要的 `reasoning_content`。

#### `toResponsesVisionToolItems(entry): ResponsesInputItem[]`

重建 OpenAI Responses 标准 `function_call` + `function_call_output` input items。

#### `toAnthropicVisionToolMessages(entry): AnthropicMessage[]`

重建 Anthropic 标准 `assistant.tool_use` + `user.tool_result` 消息。

---

### 2.15 `src/vision/historyPart.ts`

#### `createVisionToolHistoryPart(entry): vscode.LanguageModelDataPart`

创建专用 MIME 的响应 DataPart，使 VS Code 能将视觉工具历史带入下一轮上下文。

#### `parseVisionToolHistoryPart(part): VisionToolHistoryEntry | null`

识别并解析视觉工具历史 DataPart，忽略普通图片、usage 等其它 DataPart。

---

### 2.16 `src/goUsage.ts`

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

### 2.17 `src/statusBar.ts`

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

### 2.18 `src/logger.ts`

#### `class Logger`

| 方法 | 说明 |
| --- | --- |
| `init()` | 创建 VS Code `LogOutputChannel("OpenCodeGo")` |
| `debug(tag, data)` | 输出 DEBUG 级别日志 |
| `info(tag, data)` | 输出 INFO 级别日志 |
| `warn(tag, data)` | 输出 WARN 级别日志 |
| `error(tag, data)` | 输出 ERROR 级别日志 |
| `sanitizeHeaders(headers)` | 脱敏敏感 HTTP 头 (Authorization, x-api-key 等) |
| `dispose()` | 清理输出通道 |

#### `export const logger = new Logger()`

单例导出。

---

### 2.19 `src/localize.ts`

#### `l10n(key): string`

获取当前语言的本地化字符串。当前支持简体中文 (`zh-cn`)，回退到英文 key。

#### `l10nFormat(template, ...args): string`

格式化本地化字符串，替换 `{0}`, `{1}` 等占位符。

新增本地化键：

- `"Plain HTTP is only allowed for localhost or private network addresses. Use HTTPS for remote endpoints."` — Base URL 安全验证错误提示

---

### 2.20 `src/versionManager.ts`

#### `class VersionManager`

| 静态方法 | 说明 |
| --- | --- |
| `getVersion(): string` | 获取扩展版本号（从 `package.json` 读取，使用正确扩展 ID `OnesoftQwQ.opencode-go-copilot-provider` 而非旧值 `my-company.opencode-go-copilot`） |
| `getUserAgent(): string` | 构建 User-Agent 字符串（被 `CommonApi.prepareHeaders()` 用作回退 User-Agent） |
| `getClientInfo(): { name, version, author }` | 获取客户端信息 |

---

### 2.21 `src/openai/openaiTypes.ts`

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

### 2.22 `src/openai/openaiApi.ts`

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

### 2.22b `src/openai/responsesApi.ts`

#### `class ResponsesApi extends CommonApi<ResponsesInputItem, ResponsesRequestBody>`

独立的 OpenAI Responses 协议适配器。`convertMessages()` 将 VS Code 文本、图片、工具调用与工具结果转换为 typed input Items；工具结果图片使用 `function_call_output.output` 的 `input_text`/`input_image` 数组，并还原视觉历史及 encrypted reasoning 私有 DataPart。`prepareRequestBody()` 映射 `max_output_tokens`、`reasoning`、`include`、扁平 function tools（`strict:false`）及协议专属 extra 保留键；仅当模型声明支持（`supportsDisablingReasoning=true`）时才在禁用思考时发送 `reasoning.effort="none"`，否则省略 reasoning 控制并记录日志（模型按自身默认行为思考）。

#### `processStreamingResponse(responseBody, progress, token): Promise<void>`

解析 Responses SSE 类型事件：文本 delta、推理 delta、function call item/arguments、completed/incomplete/failed/error 与 usage。工具以 `output_index` 复用 `CommonApi` 缓冲和 `LanguageModelToolCallPart` 发射逻辑；完整 reasoning item 会被捕获并输出为 `application/vnd.opencodego.responses-reasoning+json` DataPart，供当前图片代理下一轮和未来会话轮次无状态续传；terminal failure 直接抛错而不是吞掉。由 `scripts/test-responses-api.mjs` 验证消息/图片/工具转换、请求体、跨 chunk SSE、工具单次发射、usage 映射与 encrypted reasoning 回放。

#### `takeCapturedReasoningItems(): ResponsesInputItem[]`

取出并清空最近一轮 Responses 流中捕获的 encrypted reasoning items，供 provider 在同一次图片代理循环的下一轮请求中放回。

#### `async *createMessage(model, systemPrompt, messages, baseUrl, apiKey, signal?): AsyncGenerator<{ type: "text"; text: string }>`

为 Git 提交消息生成发送 `store:false` 的 `/responses` 流式请求，使用顶层 `instructions` 和 typed input Items，并从 `response.output_text.delta` 逐块返回文本；失败事件直接抛错，取消时同步中止 reader。

### 2.22c `src/openai/responsesState.ts`

校验 Responses reasoning output item 的 `id`、`summary` 与 `encrypted_content`，并用专用 VS Code DataPart MIME 编解码，使 `store:false` 请求不依赖服务端保存响应状态。

### 2.22d `src/openai/responsesTypes.ts`

声明 Responses 的输入文本/图片、助手输出、reasoning、`function_call`、`function_call_output`、扁平工具、请求体、usage 与流事件类型。

---

### 2.23 `src/anthropic/anthropicTypes.ts`

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

### 2.24 `src/anthropic/anthropicApi.ts`

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

### 2.25 `src/gitCommit/commitMessageGenerator.ts`

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

### 2.26 `src/gitCommit/gitUtils.ts`

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

### 2.27 `src/tokenizer/tokenizerManager.ts`

#### `class TokenCache`

简单 LRU 缓存。

| 属性/方法 | 说明 |
| --- | --- |
| `cache` | `Map<string, number>` — 缓存存储 |
| `maxSize` | 最大条目数 (5000) |
| `maxSizeBytes` | 最大字节数 (5MB) |
| `currentSize` | 当前大小 |
| `get(key)` | 获取缓存值，更新最近使用 |
| `set(key, value)` | 设缓存值，超出限制时驱逐最久未使用的条目 |

#### `class TokenizerManager`

| 静态方法 | 说明 |
| --- | --- |
| `initialize(extensionPath)` | 设置扩展路径并获取单例 |
| `setExtensionPath(path)` | 设置扩展路径 |
| `getInstance()` | 获取单例实例 |

| 实例方法 | 说明 |
| --- | --- |
| `getTokenizer()` | 获取或创建 tiktoken 分词器实例（o200k_base） |
| `countTokens(text)` | 使用缓存和分词器计算文本 Token 数 |

#### `export const tokenizerManager = TokenizerManager.getInstance()`

导出的单例实例。

---

### 2.28 `src/tokenizer/imageUtils.ts`

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
