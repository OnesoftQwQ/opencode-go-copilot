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

### Advanced Token Usage Indicator

Once installed, the status bar shows the current context usage and cumulative input/output token counts for OpenCode Go models. DeepSeek models and models that return cache metrics via the OpenAI-compatible format also display the **cumulative cache hit count** and **cache hit rate** in the tooltip.

You can control this indicator via the `opencodego.enableThirdPartyTokenIndicator` setting (default: `true`). When disabled, only the native Copilot token indicator remains visible.

> [!NOTE]
> Whether non-DeepSeek models display cache data depends on whether the model API returns cache metrics in an OpenAI-compatible format. This does not indicate whether the model supports caching — caching support depends on OpenCode Go.

![token_counter](/assets/screenshots/token_counter.png)

### Git Commit Messages

Click the **magic wand** button in the Source Control (SCM) panel to auto-generate a commit message.

You can configure the model, language, number of recent commits to reference, and whether to attach context files.

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

You can configure the default vision model and whether to enable thinking when describing images. By default, Qwen3.6-Plus is used to describe images.

### OpenCode Zen Free Models

Disabled by default. Enable via the `opencodego.enableZenFreeModels` setting. When enabled, free models fetched from the Zen API are added to the model picker with a `Zen/` prefix (e.g. `Zen/DeepSeek V4 Flash Free`). Requires a full reload of VS Code to take effect after changing the setting.

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
| `opencodego.commitLanguage` | `auto` | Language for Git commit messages. When set to `auto`, the language is detected from recent commit history (defaults to English if no history exists). |
| `opencodego.commitModel` | `deepseek-v4-flash` | Model ID used for commit message generation. |
| `opencodego.commitMessagePrompt` | `""` | Custom system prompt for commit message generation. |
| `opencodego.requestTimeout` | `600000` | Maximum time (ms) for a single API request. Default is 600000 (10 minutes). Increase if long responses time out. |
| `opencodego.recentCommitsCount` | `10` | Number of recent commits to analyze for style reference when generating commit messages. Set to 0 to disable. |
| `opencodego.commitIncludeCommitDiff` | `false` | Include the actual code changes (diff) of recent commits in the style reference, helping the model generate messages that better match the project's commit style. |
| `opencodego.enableZenFreeModels` | `false` | Enable OpenCode Zen free models in the model picker. Zen free models are NOT supported for git commit message generation. Requires a full reload to take effect. |
| `opencodego.commitAttachContextFiles` | `true` | Attach the content of AGENTS.md and README.md from the repository root as additional context for commit message generation, helping the model better understand the project. |
| `opencodego.visionProxyModel` | `qwen3.6-plus` | Vision model used by the `ask_image` tool when the selected model does not support vision. |
| `opencodego.visionProxyThinking` | `false` | Enable thinking/reasoning in the vision proxy model when answering image queries. |

> [!NOTE]
> Models with switchable thinking (e.g., DeepSeek, Qwen) provide reasoning effort levels such as `Disabled`/`High`/`Maximum`.

### Build

```bash
npm install
npm run compile
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

1. **设置 API Key**：`Ctrl+Shift+P` → `OpenCodeGo: Set OpenCode Go API Key`
2. **显示模型**：在模型选择器中点击设置图标 → **语言模型** 面板 → 将需要使用的模型显示
3. **选择模型**：在 Copilot Chat 底部模型选择器中选择 "OpenCode Go" 或 "OpenCode Zen" 下的模型
4. **开始对话**

### 高级 Token 用量指示器

安装后，使用 OpenCode Go 提供的模型时，状态栏会显示当前上下文用量与累计输入/输出 Token 量。DeepSeek 和通过 OpenAI 格式返回缓存用量的模型还会显示**累计缓存命中量**与**缓存命中率**。

可通过 `opencodego.enableThirdPartyTokenIndicator` 设置（默认 `true`）控制此高级 Token 指示器。关闭后仅显示 Copilot 原生 Token 指示器。

> [!NOTE]
> 非 DeepSeek 的模型是否显示缓存数据取决于模型接口是否通过 OpenAI 格式返回缓存数据，这并不代表此模型是否支持缓存。模型对于缓存的支持情况取决于 OpenCode Go。

![token_counter](/assets/screenshots/token_counter.png)

### Git 提交消息

在源代码管理（SCM）面板中点击魔法棒按钮，自动生成 Git 提交消息。

可在配置里配置使用的模型、语言、参考的最近提交数量以及是否附加上下文文件。

### 扩展视觉理解

本插件为**不支持视觉理解**的**纯文本模型**添加了**扩展视觉理解**功能，当你向这些模型发送带有图片的信息时，他们可以调用支持视觉理解的模型为图片输出描述，然后再回答。

通过配置文件可更改默认使用的模型以及是否在描述图片时启用思考。默认情况下，将使用 Qwen3.6-Plus 描述图片。

### 启用 OpenCode Zen 免费模型

该功能默认关闭，通过 `opencodego.enableZenFreeModels` 设置启用。开启后，将从 Zen API 获取免费模型并添加到模型选择器中，名称带 `Zen/` 前缀（如 `Zen/DeepSeek V4 Flash Free`）。更改设置后需要重新加载 VS Code 才能生效。

### 调整模型温度

通过 `Ctrl+Shift+P` → `OpenCodeGo: Set Model Temperature Preset` 快速切换温度预设。

内置 4 个预设档位：

| 档位 | 温度 |
|------|------|
| 精确 | 0.0 |
| 均衡 | 1.0 |
| 创意 | 1.2 |
| 极具创意 | 1.7 |

也可在 `settings.json` 中直接配置 `opencodego.temperature` 和 `opencodego.top_p`（需将 `opencodego.modelPreset` 设为 `"custom"`）。

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
| `opencodego.commitLanguage` | `auto` | 提交消息语言。设为 `auto` 时将根据历史提交自动检测语言（无历史时默认英语）。 |
| `opencodego.commitModel` | `deepseek-v4-flash` | 用于生成提交消息的模型。 |
| `opencodego.commitMessagePrompt` | `""` | 生成提交消息的自定义系统提示词。 |
| `opencodego.requestTimeout` | `600000` | 单个 API 请求的最大等待时间（毫秒）。默认 600000（10 分钟）。生成长内容超时时可增大此值。 |
| `opencodego.recentCommitsCount` | `10` | 生成提交消息时参考的近期提交数量，用于学习仓库提交风格。设为 0 可禁用。 |
| `opencodego.commitIncludeCommitDiff` | `false` | 在风格参考中包含历史提交的实际代码变更（diff），帮助模型生成更符合项目提交风格的消息。 |
| `opencodego.enableZenFreeModels` | `false` | 启用 OpenCode Zen 免费模型并添加到模型选择器中。暂不支持用于 Git 提交消息生成。更改后需重载 VS Code 生效。 |
| `opencodego.commitAttachContextFiles` | `true` | 将仓库根目录的 AGENTS.md 和 README.md 作为额外上下文附加到提交消息生成中，帮助模型更好地理解项目。 |
| `opencodego.visionProxyModel` | `qwen3.6-plus` | 用于 ask_image 工具的视觉模型 ID。当所选模型不支持视觉时，该模型用于回答图片相关问题。 |
| `opencodego.visionProxyThinking` | `false` | 在视觉代理模型回答图片查询时启用思考/推理功能。 |

> [!NOTE]
> 支持切换思考模式的模型（如 DeepSeek、Qwen）提供`禁用思考`/`高`/`极高`等推理强度选项。

### 编译

```bash
npm install
npm run compile
npm run build      # 打包为 extension.vsix
```

### 许可

MIT License。本项目参考了 [oai-compatible-copilot](https://github.com/JohnnyZ93/oai-compatible-copilot) 的代码。
