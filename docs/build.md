# 编译与构建

> 开发规范见 [AGENTS.md](../AGENTS.md)，架构说明见 [architecture.md](architecture.md)，文件索引与函数定义见 [reference.md](reference.md)。

## 1. 编译命令

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

## 2. 编译配置 (tsconfig.json)

| 选项 | 值 |
| --- | --- |
| `module` | `Node16` |
| `target` | `ES2024` |
| `lib` | `["ES2024", "dom"]` |
| `strict` | `true` |
| `outDir` | `out` |
| `rootDir` | `src` |

## 3. 依赖

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| `@microsoft/tiktokenizer` | ^1.0.10 | o200k_base 分词器 |
| `@eslint/js` | 9.39.4 | ESLint JavaScript 推荐规则 |
| `@types/node` | ^22 | Node.js 类型定义 |
| `@types/vscode` | ^1.116.0 | VS Code 类型定义 |
| `eslint` | 9.39.4 | 代码检查工具 |
| `typescript` | ^5.9.2 | TypeScript 编译器 |
| `typescript-eslint` | 8.60.1 | TypeScript ESLint 配置与解析器 |

## 4. 测试脚本

| 脚本 | 说明 |
| --- | --- |
| `scripts/test-vision-history.mjs` | 视觉工具历史编解码与三 API 转换器顺序闭环测试（含 DeepSeek 空 `reasoning_content` 回归用例） |
| `scripts/test-responses-api.mjs` | OpenAI Responses 消息、请求体、SSE、工具调用、usage、encrypted reasoning 回放、缺失 MIME 与工具模式兼容测试 |
| `scripts/test-api-mode.mjs` | models.dev 适配器到三种 API 协议的映射与旧目录兼容测试 |
| `scripts/test-anthropic-tool-result-merge.mjs` | Anthropic 多条工具结果合并行为验证（issue #87） |
| `scripts/update-hardcoded-catalog.mjs` | 刷新硬编码目录快照（发布构建自动执行，失败保留旧快照不阻断） |
| `scripts/check-new-models.mjs` | 检查 models.dev 目录中的新模型 |
