import * as vscode from "vscode";
import { LanguageModelChatInformation, LanguageModelChatRequestMessage, LanguageModelChatTool } from "vscode";
import { countMessageTokens, countToolTokens } from "./provideToken";
import { l10n, l10nFormat } from "./localize";
import { logger } from "./logger";
import type { StreamUsage } from "./commonApi";
import {
    formatAgo,
    formatResetDuration,
    getUsageFetchTimestamp,
    getUsageSnapshot,
    getGoUsageCached,
    type GoUsageResult,
    type GoUsageWindow,
} from "./goUsage";

// Cumulative token counters across the session (reset on VS Code restart)
let cumulativeInputTokens = 0;
let cumulativeOutputTokens = 0;
let cumulativeCacheHitTokens = 0;
let cumulativeCacheMissTokens = 0;

// Go usage polling state (usage shown in the status bar tooltip)
let usageSecrets: vscode.SecretStorage | undefined;
let usageStatusBarItem: vscode.StatusBarItem | undefined;
let usagePollTimer: NodeJS.Timeout | undefined;
let usageRefreshInFlight = false;

/**
 * Whether the Go usage section is enabled in the status bar tooltip.
 */
function isUsageTooltipEnabled(): boolean {
    return vscode.workspace.getConfiguration("opencodego").get<boolean>("showUsageInTooltip", true);
}

/**
 * Usage refresh interval in milliseconds (clamped to 1-60 minutes).
 */
function getUsageRefreshIntervalMs(): number {
    const minutes = vscode.workspace.getConfiguration("opencodego").get<number>("usageRefreshInterval", 5);
    return Math.min(Math.max(minutes, 1), 60) * 60 * 1000;
}

/**
 * Refresh the cached Go usage (fire-and-forget). No-ops without an API key
 * or while a refresh is already in flight. On success the tooltip is
 * re-rendered so the next hover shows fresh data.
 */
async function refreshGoUsage(): Promise<void> {
    if (usageRefreshInFlight || !usageSecrets) {
        return;
    }
    usageRefreshInFlight = true;
    try {
        const apiKey = await usageSecrets.get("opencodego.apiKey");
        if (!apiKey) {
            logger.debug("goUsage.poll.skip", { reason: "no-api-key" });
            return;
        }
        const usage = await getGoUsageCached(apiKey);
        if (usage && usageStatusBarItem) {
            updateCumulativeTooltip(usageStatusBarItem);
        }
    } finally {
        usageRefreshInFlight = false;
    }
}

function stopUsagePolling(): void {
    if (usagePollTimer) {
        clearInterval(usagePollTimer);
        usagePollTimer = undefined;
        logger.debug("goUsage.poll.stop", {});
    }
}

function startUsagePolling(): void {
    stopUsagePolling();
    if (!isUsageTooltipEnabled()) {
        logger.debug("goUsage.poll.disabled", {});
        return;
    }
    // Kick off one immediate refresh (getGoUsageCached enforces its own TTL)
    void refreshGoUsage();
    const intervalMs = getUsageRefreshIntervalMs();
    usagePollTimer = setInterval(() => {
        void refreshGoUsage();
    }, intervalMs);
    logger.debug("goUsage.poll.start", { intervalMs });
}

export function initStatusBar(context: vscode.ExtensionContext, secrets: vscode.SecretStorage): vscode.StatusBarItem {
    // Reset cumulative counters on VS Code startup
    resetCumulativeCounters();

    const tokenCountStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    tokenCountStatusBarItem.name = l10n("Token Count");
    tokenCountStatusBarItem.text = `$(symbol-numeric) ${l10n("Ready")}`;
    tokenCountStatusBarItem.tooltip = l10n("Current model token usage");
    // Clicking the status bar refreshes the Go usage immediately
    tokenCountStatusBarItem.command = "opencodego.checkUsage";
    context.subscriptions.push(tokenCountStatusBarItem);
    tokenCountStatusBarItem.show();

    // Go usage polling for the tooltip section
    usageSecrets = secrets;
    usageStatusBarItem = tokenCountStatusBarItem;
    startUsagePolling();
    context.subscriptions.push({ dispose: stopUsagePolling });
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("opencodego.showUsageInTooltip") || e.affectsConfiguration("opencodego.usageRefreshInterval")) {
                startUsagePolling();
                updateCumulativeTooltip(tokenCountStatusBarItem);
            }
        })
    );

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
 * @returns The estimated input token count (for fallback usage).
 */
export async function updateContextStatusBar(
    messages: readonly LanguageModelChatRequestMessage[],
    tools: readonly LanguageModelChatTool[] | undefined,
    model: LanguageModelChatInformation,
    statusBarItem: vscode.StatusBarItem,
    modelConfig: { includeReasoningInRequest: boolean }
): Promise<number> {
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
        return totalTokens;
    } catch {
        statusBarItem.text = "$(symbol-numeric) ?";
        return 0;
    }
}

/**
 * Update the status bar main text using API-reported prompt token count.
 * Called when API returns usage data, overriding the initial client-side estimate.
 */
export function updateStatusBarWithApiPrompt(
    apiPromptTokens: number,
    maxTokens: number,
    statusBarItem: vscode.StatusBarItem
): void {
    const progressBar = createProgressBar(apiPromptTokens, maxTokens);
    const formattedTokens = formatTokenCount(apiPromptTokens);
    statusBarItem.text = `$(symbol-numeric) ${formattedTokens} ${progressBar}`;
    updateCumulativeTooltip(statusBarItem);
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
 * Append the OpenCode Go plan usage section to the tooltip lines.
 * Shows nothing (no trailing blank line) when disabled or no data is cached.
 */
function appendGoUsageTooltipLines(lines: string[]): void {
    if (!isUsageTooltipEnabled()) {
        return;
    }
    const usage = getUsageSnapshot();
    if (!usage) {
        return;
    }
    const windows: Array<[string, GoUsageWindow | undefined]> = [
        [l10n("5h window"), usage.rolling],
        [l10n("Weekly"), usage.weekly],
        [l10n("Monthly"), usage.monthly],
    ];
    const present = windows.filter((entry): entry is [string, GoUsageWindow] => entry[1] !== undefined);
    if (present.length === 0) {
        return;
    }

    lines.push("");
    lines.push(l10n("OpenCode Go Usage"));
    for (const [label, window] of present) {
        const resetText = window.resetsAt
            ? ` (${l10nFormat("resets in {0}", formatResetDuration(window.resetsAt))})`
            : "";
        lines.push(`${label}: ${Math.round(window.percent)}%${resetText}`);
    }
    if (usage.useBalance !== undefined) {
        lines.push(l10nFormat("Balance fallback: {0}", usage.useBalance ? l10n("enabled") : l10n("disabled")));
    }
    const fetchedAt = getUsageFetchTimestamp();
    if (fetchedAt !== undefined) {
        lines.push(l10nFormat("Updated {0} ago", formatAgo(fetchedAt)));
    }
}

/**
 * Update the status bar tooltip with cumulative input/output token counts,
 * DeepSeek cache info (if available) and OpenCode Go plan usage (if enabled
 * and data is cached).
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
        inputLine += ` ${l10nFormat("({0} cached, {1}%)", cacheFormatted, cachePercent)}`;
    }
    lines.push(inputLine);

    // Line 2: cumulative output
    lines.push(`${arrowDown} ${formatTokenCount(cumulativeOutputTokens)}`);

    // Section 3: OpenCode Go plan usage (optional)
    appendGoUsageTooltipLines(lines);

    statusBarItem.tooltip = lines.join("\n");
}

/**
 * Force an immediate Go usage refresh (used by the checkUsage command) and
 * re-render the tooltip once fresh data arrives.
 */
export async function refreshGoUsageNow(): Promise<GoUsageResult | null> {
    if (!usageSecrets || !usageStatusBarItem) {
        return null;
    }
    const apiKey = await usageSecrets.get("opencodego.apiKey");
    if (!apiKey) {
        return null;
    }
    // Bypass the in-flight guard for an explicit user request: reuse the
    // module-level fetch but wait for its result directly.
    usageRefreshInFlight = true;
    try {
        const usage = await getGoUsageCached(apiKey, true);
        updateCumulativeTooltip(usageStatusBarItem);
        return usage;
    } finally {
        usageRefreshInFlight = false;
    }
}
