# AGENTS.md — 开发规范

> 本文件只保留开发规范与代码约定。架构说明见 [docs/architecture.md](docs/architecture.md)，文件索引与函数定义见 [docs/reference.md](docs/reference.md)，编译构建见 [docs/build.md](docs/build.md)。

## 1. 铁律

### 1.1 编译检查

> **所有代码更改必须通过以下编译检查，确保无错误：**
>
> ```bash
> npm run compile
> # 或
> npx tsc --noEmit
> ```
>
> 任何编译错误（包括类型错误）必须在提交前修复。

### 1.2 文档同步

> **每次代码更改后，必须同步更新对应文档：**
>
> - 新增/修改/删除函数、类、接口 → 更新 `docs/reference.md`（函数定义）
> - 新增/删除/重命名文件 → 更新 `docs/reference.md`（文件索引）
> - 新增/修改/删除模型定义 → 更新 `docs/architecture.md`（模型清单）
> - 修改核心逻辑流程 → 更新 `docs/architecture.md`（逻辑架构）
> - 修改编译配置、依赖、构建命令 → 更新 `docs/build.md`
>
> 任何提交中若包含代码变更但未同步更新文档，视为不合规。

## 2. 代码风格

- 使用 TypeScript 严格模式 (`strict: true`)
- 遵循 ES2024 标准
- 使用 ESModule 模块系统 (`import`/`export`)
- 所有新的 API 函数需有 JSDoc 注释
- 导出的函数和类必须显式标注类型
- 使用 `satisfies` 操作符确保类型安全

## 3. 命名约定

| 类别 | 约定 | 示例 |
| --- | --- | --- |
| 类 | PascalCase | `OpenCodeGoChatModelProvider` |
| 接口 | PascalCase | `BuiltInModelDef`, `OpenCodeGoModelItem` |
| 类型 | PascalCase | `OpenAIChatRole`, `ParsedModelId` |
| 函数 | camelCase | `getCatalogModelConfig`, `countMessageTokens` |
| 变量 | camelCase | `requestTimeoutMs`, `apiKey` |
| 常量 | UPPER_SNAKE_CASE | `BASE_TOKENS_PER_MESSAGE`, `DEFAULT_CONTEXT_LENGTH` |
| 私有属性 | `_` 前缀 | `_lastRequestTime`, `_toolCallBuffers` |
| 文件 | camelCase | `provider.ts`, `commitMessageGenerator.ts` |

## 4. VS Code API 使用约束

- `LanguageModelChatProvider` — 必须实现 `provideLanguageModelChatResponse()` 和 `provideLanguageModelChatInformation()`
- `LanguageModelResponsePart` — 使用 `LanguageModelTextPart`、`LanguageModelThinkingPart`、`LanguageModelToolCallPart`、`LanguageModelDataPart`
- `LanguageModelChatInformation.maxOutputTokens` — 必须填入模型真实输出上限，不能为 0；VS Code 原生 Token/Context Usage 指示器会在 `maxOutputTokens <= 0` 时隐藏
- `SecretStorage` — 用于安全存储 API Key
- `LogOutputChannel` — 用于结构化日志输出
- `Progress<LanguageModelResponsePart>` — 用于流式报告响应块

### 不依赖 VS Code Proposed API

- 本扩展不使用任何 `enabledApiProposals`，所有使用的 VS Code API 均为稳定版本（VS Code 1.116+）
- `LanguageModelChatProvider`、`LanguageModelDataPart`、`LanguageModelThinkingPart` 等类型均为 VS Code 稳定 API
- `languageModelDataPart.d.ts`、`chatProvider.d.ts`、`languageModelThinkingPart.d.ts` 等类型声明文件仅用于编译期类型补全，不影响运行时行为

## 5. 错误处理策略

- 网络请求使用 `executeWithRetry()`（默认 3 次重试，指数退避）
- API 认证失败 → 弹出输入框提示用户输入
- 请求超时 → 友好的本地化错误消息
- 流式解析错误 → 记录日志，继续处理（不中断流）
- 所有未捕获错误由 `provider.ts` 的 `catch` 块统一处理

## 6. 日志规范

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

## 7. PR 内容规范

> 当要求生成 PR (Pull Request) 内容时，遵循以下模板风格。

### PR Title 格式

使用 Conventional Commit 风格：

```
<type>: <brief description>
```

type 取值：`feat` | `fix` | `refactor` | `docs` | `chore` | `improve` 等。

### PR Body 模板

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

### 撰写规范

- Title 首字母小写，用英文撰写
- Body 使用英文，用 **粗体标题** 组织 major change areas
- Changes 部分用项目符号列出每个功能点的具体变更，每点以句号结尾
- Files Changed 表格只列关键文件，说明简洁（不需要行数、路径全称）
- 不包含"如何测试"、"如何回滚"等运维内容，除非用户特别要求
- 语气精炼、直接，聚焦"改了什么"而非"为什么改"
- **从整体上审视**：按功能/模块组织内容，而非按 commit 罗列。将多个 commit 中属于同一功能点的更改合并描述，避免逐条罗列 commit 标题

## 8. 更新日志内容规范

> 当要求生成基于 Git tag 的更新日志（Changelog）时，遵循以下格式风格。

### 格式模板

```markdown
### <功能/改动类别标题>

- **<具体功能/改动点标题>**：<详细描述，说明改了什么、为什么、影响范围等>
- **<下一个具体功能/改动点标题>**：<详细描述>
- <无标题的简单变更点直接用一句话描述>

### <下一个功能/改动类别标题>

- **<具体功能/改动点标题>**：<详细描述>
- <简单变更点>
```

### 撰写规范

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
