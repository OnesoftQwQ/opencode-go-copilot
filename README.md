<div align="center">

![logo](/assets/logo.png)

# OpenCode Go Provider for Copilot

[English](#english) | [中文](#中文)

</div>

## English

> [!IMPORTANT]
> **This is not affiliated with, officially maintained by, or endorsed by OpenCode or Anomaly.**

Integrate [OpenCode Go](https://opencode.ai/go) and optional Zen free models into GitHub Copilot Chat as a VS Code extension.

The extension reads adapter metadata from models.dev and automatically routes each model through its declared OpenAI-compatible Chat Completions, OpenAI Responses, or Anthropic Messages protocol.

### Usage

1. **Set API Key**: `Ctrl+Shift+P` → `OpenCodeGo: Set OpenCode Go API Key`
2. **Show Models**: Click the settings icon in the model picker → **Language Models** panel → set your desired models to Visible
3. **Select Model**: In the Copilot Chat bottom model picker, choose an "OpenCode Go" or "OpenCode Zen" model
4. **Start chatting**

### Status Bar: Plan Usage & Token Indicator

The status bar shows your OpenCode Go plan usage for the current 5-hour window (e.g. `Go 5H 65%`, or `Go --` before the first fetch). Hover the status bar item to see:

- **Plan usage**: 5-hour / weekly / monthly utilization and the 5-hour window reset countdown.
- **Token usage**: cumulative input/output token counts, plus the cumulative cache hit count and cache hit rate for models that return cache metrics in an OpenAI-compatible format.

Click the status bar item or run `OpenCodeGo: Check OpenCode Go Usage` to refresh immediately. The tooltip usage section and the background refresh interval are controlled by `opencodego.showUsageInTooltip` (default `true`) and `opencodego.usageRefreshInterval` (default 5 minutes). The advanced token indicator can be disabled with `opencodego.enableThirdPartyTokenIndicator` (default `true`); the native Copilot token indicator always stays visible.

![status bar usage and token tooltip](/assets/screenshots/status_bar_usage.png)

> [!NOTE]
> Whether a model displays cache data depends on whether its API returns cache metrics in an OpenAI-compatible format. This does not indicate whether the model supports caching — caching support depends on OpenCode Go.

### Git Commit Messages

Click the **magic wand** button in the Source Control (SCM) panel to auto-generate a commit message.

You can configure the model, language, number of recent commits to reference, and whether to attach context files. The button can be hidden with `opencodego.enableCommitGeneration` (default `true`).

### Model Temperature Presets

Quickly switch temperature presets via `Ctrl+Shift+P` → `OpenCodeGo: Set Model Temperature Preset`.

Built-in presets:

| Preset | Temperature |
|--------|-------------|
| Precise | 0.0 |
| Balanced | 1.0 |
| Creative | 1.2 |
| Extra Creative | 1.7 |

You can also configure `opencodego.temperature` and `opencodego.top_p` directly in `settings.json` (requires `opencodego.modelPreset` set to `"custom"`).

### Extended Vision Understanding

This extension adds **extended vision understanding** capability to **text-only models** that do not natively support vision. When you send a message with an image to these models, they can call a vision-capable model to describe the image, and then answer based on that description.

You can configure the default vision model and whether to enable thinking when describing images. The default value `qwen-plus-latest` automatically selects the newest `qwen*-plus` model from the models.dev catalog.

### OpenCode Zen Free Models

Disabled by default. Enable via the `opencodego.enableZenFreeModels` setting. When enabled, free models from the OpenCode Zen provider are added to the model picker in the **OpenCode Zen** group with a ` (Zen)` name suffix (e.g. `DeepSeek V4 Flash Free (Zen)`). Reload VS Code after changing this setting. Zen free models are not supported for Git commit message generation.

### Model Catalog & Auto Discovery

The model list is driven by the [models.dev](https://models.dev) catalog. Protocol, context length, vision, reasoning options and endpoints are resolved automatically from adapter metadata, so new models appear without an extension update.

- `opencodego.enableAutoModelDiscovery` (default `true`) filters the picker to models actually available on the API; disable it to list every catalog model.
- `opencodego.showDeprecatedModels` (default `false`) reveals models marked as deprecated in the catalog.
- `opencodego.modelsDevUpdateInterval` (default `60000` ms) sets how often model updates are checked.
- Run `OpenCodeGo: Update OpenCode Go Model List (forced)` to refresh the list manually.

### Proxy / Gateway (Advanced)

Advanced users can route inference requests (chat and Git commit message generation) through a self-hosted proxy/gateway for observability, key routing or compression. Run `OpenCodeGo: Set Proxy Base URL` and acknowledge the compatibility notice; the proxy must be fully compatible with the official endpoint (same protocols, paths, model IDs and headers, and unmodified streaming responses). Usage and model list requests always use the official endpoint. Leave the value empty to disable.

### Commands

All commands are available from the command palette (`Ctrl+Shift+P` → `OpenCodeGo: ...`):

| Command | Description |
|---------|-------------|
| `OpenCodeGo: Set OpenCode Go API Key` | Set or clear the API key (stored in VS Code SecretStorage). |
| `OpenCodeGo: Get OpenCode Go API Key` | Open the opencode.ai auth page to get an API key. |
| `OpenCodeGo: Open OpenCode Go Settings` | Open the extension settings page. |
| `OpenCodeGo: Check OpenCode Go Usage` | Refresh and show OpenCode Go plan usage. |
| `OpenCodeGo: Update OpenCode Go Model List (forced)` | Force a model list refresh. |
| `OpenCodeGo: Set Model Temperature Preset` | Switch the temperature preset. |
| `OpenCodeGo: Set Proxy Base URL` | Configure the inference proxy base URL. |
| `OpenCodeGo: Reset Session Routing (New Session IDs)` | Clear the session routing registry so each conversation starts with a new session ID (escape hatch when a conversation is pinned to a degraded backend). |
| `OpenCodeGo: Generate Commit Message with OpenCodeGo` | Generate a commit message (also available as the SCM toolbar magic wand button). |
| `OpenCodeGo: Generate Commit Message with OpenCodeGo - Stop` | Abort commit message generation. |

### Configuration

Available in `settings.json`:

```json
{
  "opencodego.commitLanguage": "auto",
  "opencodego.commitModel": "deepseek-v4-flash",
  "opencodego.commitMessagePrompt": "",
  "opencodego.requestTimeout": 600000,
  "opencodego.recentCommitsCount": 10,
  "opencodego.commitIncludeCommitDiff": false,
  "opencodego.commitAttachContextFiles": true
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `opencodego.requestTimeout` | `600000` | Maximum time (ms) for a single API request. Increase if long responses time out. |
| `opencodego.delay` | `0` | Delay (ms) between consecutive API requests to avoid rate limiting. |
| `opencodego.retry.enabled` | `true` | Retry failed API requests with exponential backoff. |
| `opencodego.retry.max_attempts` | `3` | Maximum number of retry attempts. |
| `opencodego.retry.interval_ms` | `1000` | Initial delay (ms) before the first retry; grows exponentially. |
| `opencodego.retry.status_codes` | `[]` | Additional HTTP status codes that trigger a retry, on top of 429/500/502/503/504. |
| `opencodego.modelPreset` | `precise` | Active temperature preset ID. Set to `custom` to use the manual `temperature` / `top_p` values. |
| `opencodego.temperature` | `null` | Temperature (0.0 - 2.0) used when `modelPreset` is `custom`. |
| `opencodego.top_p` | `null` | top_p (0.0 - 1.0) used when `modelPreset` is `custom`. |
| `opencodego.modelPresets` | built-in presets | Preset definitions (`id`, `label`, `temperature`, optional `top_p`). |
| `opencodego.enableZenFreeModels` | `false` | Add OpenCode Zen free models to the picker (` (Zen)` suffix). Not supported for Git commit generation. Reload required. |
| `opencodego.enableAutoModelDiscovery` | `true` | Filter the model picker to models available on the API. |
| `opencodego.showDeprecatedModels` | `false` | Show models marked as deprecated in the models.dev catalog. |
| `opencodego.modelsDevUpdateInterval` | `60000` | Cache TTL (ms) for checking model updates. Minimum 30000. |
| `opencodego.enableThirdPartyTokenIndicator` | `true` | Show the advanced token indicator in the status bar tooltip. |
| `opencodego.showUsageInTooltip` | `true` | Show the OpenCode Go plan usage section in the status bar tooltip. |
| `opencodego.usageRefreshInterval` | `5` | Background plan-usage refresh interval (minutes, 1-60). |
| `opencodego.enableCommitGeneration` | `true` | Show the generate commit message button in the SCM panel. |
| `opencodego.commitLanguage` | `auto` | Language for Git commit messages; `auto` detects it from recent commits (defaults to English). |
| `opencodego.commitModel` | `deepseek-v4-flash` | Model ID used for commit message generation. |
| `opencodego.commitMessagePrompt` | `""` | Custom system prompt for commit message generation. |
| `opencodego.recentCommitsCount` | `10` | Number of recent commits used as style reference. Set to 0 to disable. |
| `opencodego.commitIncludeCommitDiff` | `false` | Include the actual diffs of recent commits in the style reference. |
| `opencodego.commitAttachContextFiles` | `true` | Attach AGENTS.md and README.md from the repository root as extra context. |
| `opencodego.visionProxyModel` | `qwen-plus-latest` | Vision model used by the `ask_image` tool. The special value `qwen-plus-latest` auto-selects the newest `qwen*-plus` model. |
| `opencodego.visionProxyThinking` | `false` | Enable thinking/reasoning in the vision proxy model. |
| `opencodego.visionMaxRounds` | `5` | Maximum number of vision proxy follow-up rounds per request. |
| `opencodego.readFileLines` | `0` | Automatically adjust `read_file` tool calls to read this many lines. 0 disables. |
| `opencodego.inferenceBaseUrl` | `""` | Advanced: route inference requests through a self-hosted proxy/gateway. Prefer the `OpenCodeGo: Set Proxy Base URL` command. Machine scope; usage and model list requests always use the official endpoint. |

> [!NOTE]
> Models with switchable thinking (e.g., DeepSeek, Qwen) provide reasoning effort levels such as `Disabled`/`High`/`Maximum`.

### Build

```bash
npm install
npm run compile
npm test           # runs the test scripts
npm run build      # packages extension.vsix
```

### License

MIT License. This project references code from [oai-compatible-copilot](https://github.com/JohnnyZ93/oai-compatible-copilot).

---

## 中文

> [!IMPORTANT]
> **本插件与 OpenCode 官方或 Anomaly 无关，也未获得其官方维护或认可。**

将 [OpenCode Go](https://opencode.ai/go) 以及可选的 Zen 免费模型集成到 GitHub Copilot Chat 的 VS Code 插件。

插件会读取 models.dev 的适配器元数据，自动按模型声明选择 OpenAI 兼容 Chat Completions、OpenAI Responses 或 Anthropic Messages 请求格式。

### 使用

1. **设置 API Key**：`Ctrl+Shift+P` → `OpenCodeGo: 设置 OpenCode Go API 密钥`
2. **显示模型**：在模型选择器中点击设置图标 → **语言模型** 面板 → 将需要使用的模型显示
3. **选择模型**：在 Copilot Chat 底部模型选择器中选择 "OpenCode Go" 或 "OpenCode Zen" 下的模型
4. **开始对话**

### 状态栏：套餐用量与 Token 指示器

状态栏显示 OpenCode Go 套餐当前 5 小时窗口的用量（如 `Go 5H 65%`，首次获取前显示 `Go --`）。悬停状态栏条目可查看：

- **套餐用量**：5 小时 / 周 / 月三个窗口的使用率与 5 小时窗口的重置倒计时。
- **Token 用量**：累计输入/输出 Token 量；当模型接口以 OpenAI 兼容格式返回缓存数据时，还会显示**累计缓存命中量**与**缓存命中率**。

点击状态栏条目或运行 `OpenCodeGo: 查询 OpenCode Go 用量` 命令可立即刷新。tooltip 中的用量区块与后台刷新间隔由 `opencodego.showUsageInTooltip`（默认开启）和 `opencodego.usageRefreshInterval`（默认 5 分钟）控制。可通过 `opencodego.enableThirdPartyTokenIndicator`（默认开启）关闭高级 Token 指示器；Copilot 原生 Token 指示器不受影响。

![状态栏套餐用量与 Token 提示](/assets/screenshots/status_bar_usage.png)

> [!NOTE]
> 模型是否显示缓存数据取决于其接口是否通过 OpenAI 兼容格式返回缓存数据，这并不代表该模型是否支持缓存。缓存支持情况取决于 OpenCode Go。

### Git 提交消息

在源代码管理（SCM）面板中点击魔法棒按钮，自动生成 Git 提交消息。

可在配置里配置使用的模型、语言、参考的最近提交数量以及是否附加上下文文件。可通过 `opencodego.enableCommitGeneration`（默认开启）隐藏该按钮。

### 调整模型温度

通过 `Ctrl+Shift+P` → `OpenCodeGo: 设置模型温度预设` 快速切换温度预设。

内置 4 个预设档位：

| 档位 | 温度 |
|------|------|
| 精确 | 0.0 |
| 均衡 | 1.0 |
| 创意 | 1.2 |
| 极具创意 | 1.7 |

也可在 `settings.json` 中直接配置 `opencodego.temperature` 和 `opencodego.top_p`（需将 `opencodego.modelPreset` 设为 `"custom"`）。

### 扩展视觉理解

本插件为**不支持视觉理解**的**纯文本模型**添加了**扩展视觉理解**功能，当你向这些模型发送带有图片的信息时，他们可以调用支持视觉理解的模型为图片输出描述，然后再回答。

通过配置文件可更改默认使用的模型以及是否在描述图片时启用思考。默认值 `qwen-plus-latest` 会自动选择 models.dev 目录中最新的 `qwen*-plus` 模型。

### 启用 OpenCode Zen 免费模型

该功能默认关闭，通过 `opencodego.enableZenFreeModels` 设置启用。开启后，来自 OpenCode Zen 服务商的免费模型会以 ` (Zen)` 名称后缀加入模型选择器的 **OpenCode Zen** 分组（如 `DeepSeek V4 Flash Free (Zen)`）。更改设置后需重新加载 VS Code 生效。Zen 免费模型暂不支持用于 Git 提交消息生成。

### 模型目录与自动发现

模型列表由 [models.dev](https://models.dev) 目录驱动，协议、上下文长度、视觉能力、思考档位与端点等元数据均自动从适配器信息解析，新模型无需更新插件即可出现。

- `opencodego.enableAutoModelDiscovery`（默认开启）会按 API 实际可用的模型过滤选择器；关闭后显示目录中的全部模型。
- `opencodego.showDeprecatedModels`（默认关闭）显示目录中标记为已弃用的模型。
- `opencodego.modelsDevUpdateInterval`（默认 `60000` 毫秒）控制模型更新检查的缓存间隔。
- 运行 `OpenCodeGo: 更新 OpenCode Go 模型列表 (强制)` 命令可手动刷新。

### 代理 / 网关（高级）

高级用户可将推理请求（聊天与 Git 提交消息生成）通过自建代理/网关转发，用于可观测性、多 Key 路由或压缩等场景。运行 `OpenCodeGo: 设置代理 Base URL` 命令并确认兼容性提示即可配置；代理必须与官方端点完全兼容（协议、路径、模型 ID、请求头一致，且不得改写流式响应）。用量查询与模型列表请求始终访问官方地址，留空可禁用。

### 命令

所有命令均可从命令面板（`Ctrl+Shift+P` → `OpenCodeGo: ...`）执行：

| 命令 | 说明 |
|------|------|
| `OpenCodeGo: 设置 OpenCode Go API 密钥` | 设置或清除 API 密钥（保存在 VS Code SecretStorage 中）。 |
| `OpenCodeGo: 获取 OpenCode Go API 密钥` | 打开 opencode.ai 授权页面获取 API 密钥。 |
| `OpenCodeGo: 打开 OpenCode Go 设置` | 打开插件设置页面。 |
| `OpenCodeGo: 查询 OpenCode Go 用量` | 刷新并显示 OpenCode Go 套餐用量。 |
| `OpenCodeGo: 更新 OpenCode Go 模型列表 (强制)` | 强制刷新模型列表。 |
| `OpenCodeGo: 设置模型温度预设` | 切换模型温度预设。 |
| `OpenCodeGo: 设置代理 Base URL` | 配置推理请求的代理 Base URL。 |
| `OpenCodeGo: 重置会话路由(使用新会话 ID)` | 清空会话路由登记表，使各会话的下一次请求使用新会话 ID（会话被钉在故障后端时的逃生手段）。 |
| `OpenCodeGo: 使用 OpenCodeGo 生成提交消息` | 生成提交消息（SCM 工具栏魔法棒按钮亦可触发）。 |
| `OpenCodeGo: 使用 OpenCodeGo 生成提交消息 - 停止` | 中止提交消息生成。 |

### 配置

可在 `settings.json` 中配置：

```json
{
  "opencodego.commitLanguage": "auto",
  "opencodego.commitModel": "deepseek-v4-flash",
  "opencodego.commitMessagePrompt": "",
  "opencodego.requestTimeout": 600000,
  "opencodego.recentCommitsCount": 10,
  "opencodego.commitIncludeCommitDiff": false,
  "opencodego.commitAttachContextFiles": true
}
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `opencodego.requestTimeout` | `600000` | 单个 API 请求的最大等待时间（毫秒）。生成长内容超时时可增大此值。 |
| `opencodego.delay` | `0` | 连续 API 请求之间的延迟（毫秒），用于避免触发频率限制。 |
| `opencodego.retry.enabled` | `true` | 启用失败 API 请求的自动重试（指数退避）。 |
| `opencodego.retry.max_attempts` | `3` | 最大重试次数。 |
| `opencodego.retry.interval_ms` | `1000` | 首次重试前的初始延迟（毫秒），按指数递增。 |
| `opencodego.retry.status_codes` | `[]` | 除 429/500/502/503/504 外，额外触发重试的 HTTP 状态码。 |
| `opencodego.modelPreset` | `precise` | 当前温度预设 ID。设为 `custom` 时使用手动配置的 `temperature` / `top_p`。 |
| `opencodego.temperature` | `null` | `modelPreset` 为 `custom` 时使用的温度（0.0 - 2.0）。 |
| `opencodego.top_p` | `null` | `modelPreset` 为 `custom` 时使用的 top_p（0.0 - 1.0）。 |
| `opencodego.modelPresets` | 内置预设 | 温度预设定义（`id`、`label`、`temperature`，可选 `top_p`）。 |
| `opencodego.enableZenFreeModels` | `false` | 将 OpenCode Zen 免费模型加入模型选择器（` (Zen)` 后缀）。暂不支持 Git 提交生成，更改后需重载。 |
| `opencodego.enableAutoModelDiscovery` | `true` | 按 API 实际可用的模型过滤模型选择器。 |
| `opencodego.showDeprecatedModels` | `false` | 显示 models.dev 目录中标记为已弃用的模型。 |
| `opencodego.modelsDevUpdateInterval` | `60000` | 模型更新检查的缓存 TTL（毫秒），最小 30000。 |
| `opencodego.enableThirdPartyTokenIndicator` | `true` | 在状态栏 tooltip 中显示高级 Token 指示器。 |
| `opencodego.showUsageInTooltip` | `true` | 在状态栏 tooltip 中显示 Go 套餐用量区块。 |
| `opencodego.usageRefreshInterval` | `5` | 后台套餐用量刷新间隔（分钟，1-60）。 |
| `opencodego.enableCommitGeneration` | `true` | 在源代码管理面板显示生成提交消息按钮。 |
| `opencodego.commitLanguage` | `auto` | 提交消息语言；`auto` 根据历史提交自动检测（无历史时默认英语）。 |
| `opencodego.commitModel` | `deepseek-v4-flash` | 用于生成提交消息的模型。 |
| `opencodego.commitMessagePrompt` | `""` | 生成提交消息的自定义系统提示词。 |
| `opencodego.recentCommitsCount` | `10` | 生成提交消息时参考的近期提交数量。设为 0 可禁用。 |
| `opencodego.commitIncludeCommitDiff` | `false` | 在风格参考中包含历史提交的实际代码变更（diff）。 |
| `opencodego.commitAttachContextFiles` | `true` | 将仓库根目录的 AGENTS.md 和 README.md 作为额外上下文附加。 |
| `opencodego.visionProxyModel` | `qwen-plus-latest` | `ask_image` 工具使用的视觉模型。特殊值 `qwen-plus-latest` 会自动选择最新的 `qwen*-plus` 模型。 |
| `opencodego.visionProxyThinking` | `false` | 在视觉代理模型回答图片查询时启用思考/推理。 |
| `opencodego.visionMaxRounds` | `5` | 每次请求的最大视觉代理追问轮数。 |
| `opencodego.readFileLines` | `0` | 自动将 `read_file` 工具调用调整为读取指定行数。设为 0 表示不调整。 |
| `opencodego.inferenceBaseUrl` | `""` | 高级设置：将推理请求通过自建代理/网关转发。建议使用 `OpenCodeGo: 设置代理 Base URL` 命令设置。machine 作用域；用量与模型列表请求始终走官方地址。 |

> [!NOTE]
> 支持切换思考模式的模型（如 DeepSeek、Qwen）提供`禁用思考`/`高`/`极高`等推理强度选项。

### 编译

```bash
npm install
npm run compile
npm test           # 运行测试脚本
npm run build      # 打包为 extension.vsix
```

### 许可

MIT License。本项目参考了 [oai-compatible-copilot](https://github.com/JohnnyZ93/oai-compatible-copilot) 的代码。
