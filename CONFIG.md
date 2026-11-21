# Configuration / 配置

[English](#english) | [中文](#中文)

## English

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
| `opencodego.modelPreset` | `default` | Active temperature preset ID. `default` sends no temperature/top_p; set to `custom` to use the manual `temperature` / `top_p` values. |
| `opencodego.temperature` | `null` | Temperature (0.0 - 2.0) used when `modelPreset` is `custom`. |
| `opencodego.top_p` | `null` | top_p (0.0 - 1.0) used when `modelPreset` is `custom`. |
| `opencodego.modelPresets` | built-in presets | Preset definitions (`id`, `label`, optional `temperature` / `top_p`; omit temperature to send no parameter). |
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
| `opencodego.visionProxyModel` | `deepseek-v4.1-flash` | Vision model used by the `ask_image` tool. |
| `opencodego.visionProxyThinking` | `false` | Enable thinking/reasoning in the vision proxy model. |
| `opencodego.visionMaxRounds` | `5` | Maximum number of vision proxy follow-up rounds per request. |
| `opencodego.readFileLines` | `0` | Automatically adjust `read_file` tool calls to read this many lines. 0 disables. |
| `opencodego.inferenceBaseUrl` | `""` | Advanced: route inference requests through a self-hosted proxy/gateway. Prefer the `OpenCodeGo: Set Proxy Base URL` command. Machine scope; usage and model list requests always use the official endpoint. |

> **Note**: Models with switchable thinking (e.g., DeepSeek, Qwen) provide reasoning effort levels such as `Disabled`/`High`/`Maximum`.

## 中文

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
| `opencodego.modelPreset` | `default` | 当前温度预设 ID。`default` 不发送 temperature/top_p；设为 `custom` 时使用手动配置的 `temperature` / `top_p`。 |
| `opencodego.temperature` | `null` | `modelPreset` 为 `custom` 时使用的温度（0.0 - 2.0）。 |
| `opencodego.top_p` | `null` | `modelPreset` 为 `custom` 时使用的 top_p（0.0 - 1.0）。 |
| `opencodego.modelPresets` | 内置预设 | 温度预设定义（`id`、`label`，可选 `temperature` / `top_p`；省略温度则不发送该参数）。 |
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
| `opencodego.visionProxyModel` | `deepseek-v4.1-flash` | `ask_image` 工具使用的视觉模型。 |
| `opencodego.visionProxyThinking` | `false` | 在视觉代理模型回答图片查询时启用思考/推理。 |
| `opencodego.visionMaxRounds` | `5` | 每次请求的最大视觉代理追问轮数。 |
| `opencodego.readFileLines` | `0` | 自动将 `read_file` 工具调用调整为读取指定行数。设为 0 表示不调整。 |
| `opencodego.inferenceBaseUrl` | `""` | 高级设置：将推理请求通过自建代理/网关转发。建议使用 `OpenCodeGo: 设置代理 Base URL` 命令设置。machine 作用域；用量与模型列表请求始终走官方地址。 |

> **注**：支持切换思考模式的模型（如 DeepSeek、Qwen）提供`禁用思考`/`高`/`极高`等推理强度选项。
