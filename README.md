# OpenCode Go Copilot

[English](#english) | [中文](#中文)

---

## English

> **This is not affiliated with, officially maintained by, or endorsed by OpenCode or Anomaly.**

Integrate [OpenCode Go](https://opencode.ai/go) models into GitHub Copilot Chat as a VS Code extension.

### Usage

1. **Set API Key**: `Ctrl+Shift+P` → `OpenCodeGo: Set OpenCode Go API Key`
2. **Show Models**: Click the settings icon ⚙️ in the model picker → **Language Models** panel → set your desired models to Visible
3. **Select Model**: In the Copilot Chat bottom model picker, choose an "OpenCode Go" model
4. **Start chatting**

### Token Usage Indicator

Once installed, when using a model provided by OpenCode Go, the status bar will display the current context usage and cumulative input/output token counts. For DeepSeek and models that support returning cache usage via the OpenAI-compatible format, the tooltip will also show the **cumulative input cache hit count** and **cache hit rate**.

![token_counter](/assets/screenshots/token_counter.png)

### Git Commit Messages

Click the **magic wand** button in the Source Control (SCM) panel to auto-generate a commit message.

### Configuration

Available in `settings.json`:

```json
{
  "opencodego.commitLanguage": "English",
  "opencodego.commitModel": "deepseek-v4-flash",
  "opencodego.commitMessagePrompt": ""
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `opencodego.commitLanguage` | `English` | Language for Git commit messages |
| `opencodego.commitModel` | `deepseek-v4-flash` | Model ID used for commit generation |
| `opencodego.commitMessagePrompt` | `""` | Custom system prompt for commit message generation |

> All requests use `temperature: 0` for deterministic output.  
> DeepSeek Thinking variants expose a **Thinking Effort** picker in the model selector with levels `low`, `medium`, `high`, and `max` (default: `max`). MiMo models also expose a **Thinking Effort** picker with `low`, `medium`, and `high` (default: `high`).

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

> **本插件与 OpenCode 或 Anomaly 无关，也未获得其官方维护或认可。**

将 [OpenCode Go](https://opencode.ai/go) 模型集成到 GitHub Copilot Chat 的 VS Code 扩展。

### 使用

1. **设置 API Key**：`Ctrl+Shift+P` → `OpenCodeGo: Set OpenCode Go API Key`
2. **显示模型**：在模型选择器中点击设置图标 ⚙️ → **语言模型** 面板 → 将需要的模型显示
3. **选择模型**：在 Copilot Chat 底部模型选择器中选 "OpenCode Go" 下的模型
4. **开始对话**

### Token 用量指示器

安装后，使用 OpenCode Go 所提供的模型时，底部将会显示当前上下文用量与会话累计输入/输出 Token 量，同时 DeepSeek 与支持通过 OpenAI 格式返回缓存用量的模型还将显示**累计输入缓存命中量**与**缓存命中率**。

![token_counter](/assets/screenshots/token_counter.png)

### Git 提交消息

在源代码管理（SCM）面板中点击魔法棒按钮，自动生成 Git 提交消息。

### 配置

可在 `settings.json` 中配置：

```json
{
  "opencodego.commitLanguage": "Chinese (Simplified)",
  "opencodego.commitModel": "deepseek-v4-flash",
  "opencodego.commitMessagePrompt": ""
}
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `opencodego.commitLanguage` | `English` | 提交消息语言 |
| `opencodego.commitModel` | `deepseek-v4-flash` | 用于生成提交消息的模型 |
| `opencodego.commitMessagePrompt` | `""` | 生成提交消息的自定义系统提示词 |

> 所有请求使用 `temperature: 0` 以确保输出确定性。  
> DeepSeek Thinking 变体在模型选择器中提供 **思考深度 (Thinking Effort)** 选项，可选 `low`、`medium`、`high`、`max`（默认 `max`）。MiMo 系列同样提供 **思考深度** 选项，可选 `low`、`medium`、`high`（默认 `high`）。

### 编译

```bash
npm install
npm run compile
npm run build      # 打包为 extension.vsix
```

### 许可

MIT License。参考了 [oai-compatible-copilot](https://github.com/JohnnyZ93/oai-compatible-copilot) 的代码。
