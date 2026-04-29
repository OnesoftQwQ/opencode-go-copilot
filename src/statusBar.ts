import * as vscode from "vscode";
import { LanguageModelChatInformation, LanguageModelChatRequestMessage, LanguageModelChatTool } from "vscode";
import { countMessageTokens, countToolTokens } from "./provideToken";
import { l10n, l10nFormat } from "./localize";
import type { StreamUsage } from "./commonApi";

// Cumulative token counters across the session (reset on VS Code restart)
let cumulativeInputTokens = 0;
let cumulativeOutputTokens = 0;
let cumulativeCacheHitTokens = 0;
let cumulativeCacheMissTokens = 0;

export function initStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
    // Reset cumulative counters on VS Code startup
    resetCumulativeCounters();

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
 * Resets cumulative counters when a new conversation starts
 * (no assistant messages in the history).
 */
export async function updateContextStatusBar(
    messages: readonly LanguageModelChatRequestMessage[],
    tools: readonly LanguageModelChatTool[] | undefined,
    model: LanguageModelChatInformation,
    statusBarItem: vscode.StatusBarItem,
    modelConfig: { includeReasoningInRequest: boolean }
): Promise<void> {
    try {
        // Detect new conversation: no assistant messages → reset cumulative counters
        const ASSISTANT = vscode.LanguageModelChatMessageRole.Assistant as unknown as number;
        const hasAssistantMessages = messages.some(m => (m.role as unknown as number) === ASSISTANT);
        if (!hasAssistantMessages) {
            resetCumulativeCounters();
        }

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
        // Always show cumulative tooltip (not per-request) to avoid flickering
        updateCumulativeTooltip(statusBarItem);
    } catch {
        statusBarItem.text = "$(symbol-numeric) ?";
    }
}

/**
 * Reset all cumulative token counters (called on VS Code startup and new conversation).
 */
export function resetCumulativeCounters(): void {
    cumulativeInputTokens = 0;
    cumulativeOutputTokens = 0;
    cumulativeCacheHitTokens = 0;
    cumulativeCacheMissTokens = 0;
}

/**
 * Record streaming usage data into cumulative counters.
 */
export function recordUsage(usage: StreamUsage): void {
    cumulativeInputTokens += usage.promptTokens;
    cumulativeOutputTokens += usage.completionTokens;
    if (usage.cacheHitTokens !== undefined) {
        cumulativeCacheHitTokens += usage.cacheHitTokens;
    }
    if (usage.cacheMissTokens !== undefined) {
        cumulativeCacheMissTokens += usage.cacheMissTokens;
    }
}

/**
 * Update the status bar tooltip with cumulative input/output token counts
 * and DeepSeek cache info (if available).
 */
export function updateCumulativeTooltip(statusBarItem: vscode.StatusBarItem): void {
    const arrowUp = "\u2191";
    const arrowDown = "\u2193";
    const lines: string[] = [];

    // Line 1: cumulative input + cache info
    let inputLine = `${arrowUp} ${formatTokenCount(cumulativeInputTokens)}`;
    if (cumulativeCacheHitTokens > 0 || cumulativeCacheMissTokens > 0) {
        const totalCache = cumulativeCacheHitTokens + cumulativeCacheMissTokens;
        const cachePercent = totalCache > 0
            ? Math.round((cumulativeCacheHitTokens / totalCache) * 100)
            : 0;
        const cacheFormatted = formatTokenCount(cumulativeCacheHitTokens);
        inputLine += ` (${cacheFormatted} cached, ${cachePercent}%)`;
    }
    lines.push(inputLine);

    // Line 2: cumulative output
    lines.push(`${arrowDown} ${formatTokenCount(cumulativeOutputTokens)}`);

    statusBarItem.tooltip = lines.join("\n");
}
