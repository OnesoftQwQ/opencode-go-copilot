import * as vscode from "vscode";
import { LanguageModelChatInformation, LanguageModelChatRequestMessage, LanguageModelChatTool } from "vscode";
import { countMessageTokens, countToolTokens } from "./provideToken";
import { l10n, l10nFormat } from "./localize";

export function initStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const tokenCountStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    tokenCountStatusBarItem.name = l10n("Token Count");
    tokenCountStatusBarItem.text = `$(symbol-numeric) ${l10n("Ready")}`;
    tokenCountStatusBarItem.tooltip = l10n("Current model token usage");
    context.subscriptions.push(tokenCountStatusBarItem);
    tokenCountStatusBarItem.show();
    return tokenCountStatusBarItem;
}

/**
 * Format number to thousands (K, M, B) format.
 */
export function formatTokenCount(value: number): string {
    if (value >= 1_000_000_000) {
        return (value / 1_000_000_000).toFixed(1) + "B";
    } else if (value >= 1_000_000) {
        return (value / 1_000_000).toFixed(1) + "M";
    } else if (value >= 1_000) {
        return (value / 1_000).toFixed(1) + "K";
    }
    return value.toLocaleString();
}

/**
 * Create a visual progress bar showing token usage.
 */
export function createProgressBar(usedTokens: number, maxTokens: number): string {
    const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
    const usagePercentage = Math.min((usedTokens / maxTokens) * 100, 100);
    const blockIndex = Math.min(Math.floor((usagePercentage / 100) * blocks.length), blocks.length - 1);

    return `${blocks[blockIndex]} ${usagePercentage.toFixed(1)}%`;
}

/**
 * Update the status bar with token usage information.
 */
export async function updateContextStatusBar(
    messages: readonly LanguageModelChatRequestMessage[],
    tools: readonly LanguageModelChatTool[] | undefined,
    model: LanguageModelChatInformation,
    statusBarItem: vscode.StatusBarItem,
    modelConfig: { includeReasoningInRequest: boolean }
): Promise<void> {
    try {
        let totalTokens = 0;

        for (const message of messages) {
            totalTokens += await countMessageTokens(message, modelConfig);
        }

        if (tools && tools.length > 0) {
            totalTokens += await countToolTokens(tools);
        }

        const maxTokens = model.maxInputTokens || 128000;
        const progressBar = createProgressBar(totalTokens, maxTokens);
        const formattedTokens = formatTokenCount(totalTokens);

        statusBarItem.text = `$(symbol-numeric) ${formattedTokens} ${progressBar}`;
        statusBarItem.tooltip = l10nFormat("Token Usage: {0} / {1}", totalTokens.toLocaleString(), maxTokens.toLocaleString());
    } catch {
        statusBarItem.text = "$(symbol-numeric) ?";
    }
}
