import * as vscode from "vscode";

const zhCN: Record<string, string> = {
	// statusBar
	"Token Count": "Token 计数",
	"Current model token usage": "当前模型 token 使用量",
	"Token Usage": "Token 使用量",
	"Ready": "就绪",

	// extension.ts - API key prompts
	"OpenCode Go Provider API Key": "OpenCode Go 提供商 API 密钥",
	"Update your OpenCode Go API key": "更新您的 OpenCode Go API 密钥",
	"Enter your OpenCode Go API key": "输入您的 OpenCode Go API 密钥",
	"OpenCode Go API key cleared.": "OpenCode Go API 密钥已清除。",
	"OpenCode Go API key saved.": "OpenCode Go API 密钥已保存。",

	// provider.ts
	"OpenCode Go API key not found": "未找到 OpenCode Go API 密钥",
	"Invalid base URL configuration.": "无效的 Base URL 配置。",

	// commit info messages
	"Cache": "缓存",
	"No changes found in any workspace repositories.": "在任何工作区仓库中均未发现更改。",
	"Git extension not found": "未找到 Git 扩展",
	"No Git repositories available": "没有可用的 Git 仓库",
	"Repository not found for provided SCM": "未找到指定 SCM 对应的仓库",
	"No models configured for commit message generation. Please set 'useForCommitGeneration' to true for at least one model in your configuration.":
		"未配置用于生成提交消息的模型。请在配置中将至少一个模型的 'useForCommitGeneration' 设为 true。",
	"Failed to generate commit message:": "生成提交消息失败：",
	"[Commit Generation Failed]": "[提交生成失败]",
	"empty API response": "API 返回为空",
};

/**
 * Get the localized string for the given key.
 * Falls back to the key itself if no translation is available.
 */
export function l10n(key: string): string {
	const language = vscode.env.language;
	if (zhCN[key] && (language.toLowerCase() === "zh-cn" || language.toLowerCase().startsWith("zh"))) {
		return zhCN[key];
	}
	return key;
}

/**
 * Format a localized string with replacements.
 * Usage: l10nFormat("Token Usage: {0} / {1}", "12.5K", "1M")
 */
export function l10nFormat(template: string, ...args: (string | number)[]): string {
	let str = l10n(template);
	for (let i = 0; i < args.length; i++) {
		str = str.replace(`{${i}}`, String(args[i]));
	}
	return str;
}
