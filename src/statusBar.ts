import * as vscode from "vscode";
import { LanguageModelChatRequestMessage, LanguageModelChatTool } from "vscode";
import { countMessageTokens, countToolTokens } from "./provideToken";
import { l10n, l10nFormat } from "./localize";
import { logger } from "./logger";
import type { StreamUsage } from "./commonApi";
import {
    formatResetDuration,
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
 * or while a refresh is already in flight. On success the status bar text
 * and tooltip are re-rendered so the next glance/hover shows fresh data.
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
            updateStatusBarGoUsageText(usageStatusBarItem);
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
    // Polling always runs (when an API key exists) because the status bar
    // main text shows the Go usage; showUsageInTooltip only gates the
    // tooltip section.
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
    tokenCountStatusBarItem.name = l10n("Go Usage");
    tokenCountStatusBarItem.text = "$(symbol-numeric) Go --";
    tokenCountStatusBarItem.tooltip = l10n("Go usage and token usage");
    // Clicking the status bar refreshes the Go usage immediately
    tokenCountStatusBarItem.command = "opencodego.checkUsage";
    context.subscriptions.push(tokenCountStatusBarItem);
    tokenCountStatusBarItem.show();

    // Go usage polling for the status bar text and tooltip section
    usageSecrets = secrets;
    usageStatusBarItem = tokenCountStatusBarItem;
    startUsagePolling();
    context.subscriptions.push({ dispose: stopUsagePolling });
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("opencodego.showUsageInTooltip") || e.affectsConfiguration("opencodego.usageRefreshInterval")) {
                startUsagePolling();
                updateStatusBarGoUsageText(tokenCountStatusBarItem);
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
 * Update the status bar main text with the Go plan usage (5h window),
 * e.g. "$(symbol-numeric) Go 5H 65%", or "$(symbol-numeric) Go --"
 * while no usage data is available.
 */
function updateStatusBarGoUsageText(statusBarItem: vscode.StatusBarItem): void {
    const usage = getUsageSnapshot();
    const percent = usage?.rolling?.percent;
    statusBarItem.text = percent !== undefined
        ? `$(symbol-numeric) Go 5H ${Math.round(percent)}%`
        : "$(symbol-numeric) Go --";
}

/**
 * Update the status bar with token usage information.
 * Resets cumulative counters when a new conversation starts
 * (no assistant messages in the history). The status bar main text shows
 * the Go plan usage (see updateStatusBarGoUsageText); token counts live in
 * the tooltip.
 * @returns The estimated input token count (for fallback usage).
 */
export async function updateContextStatusBar(
    messages: readonly LanguageModelChatRequestMessage[],
    tools: readonly LanguageModelChatTool[] | undefined,
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

        updateStatusBarGoUsageText(statusBarItem);
        // Always show cumulative tooltip (not per-request) to avoid flickering
        updateCumulativeTooltip(statusBarItem);
        return totalTokens;
    } catch {
        updateStatusBarGoUsageText(statusBarItem);
        return 0;
    }
}

/**
 * Re-render the status bar after the API reports usage data
 * (status bar main text = Go usage, tooltip = cumulative token counts).
 */
export function updateStatusBarWithApiPrompt(statusBarItem: vscode.StatusBarItem): void {
    updateStatusBarGoUsageText(statusBarItem);
    updateCumulativeTooltip(statusBarItem);
}

/**
 * Reset all cumulative token counters (called on VS Code startup and new conversation).
 */
function resetCumulativeCounters(): void {
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
 * Compact layout: one line per window ("5H 65%" / "周 30%" / "月 12%")
 * and the 5h window reset countdown.
 * Shows nothing when disabled or no data is cached.
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
        ["5H", usage.rolling],
        [l10n("Week"), usage.weekly],
        [l10n("Month"), usage.monthly],
    ];
    const present = windows.filter((entry): entry is [string, GoUsageWindow] => entry[1] !== undefined);
    if (present.length === 0) {
        return;
    }

    for (const [label, window] of present) {
        lines.push(`${label} ${Math.round(window.percent)}%`);
    }
    if (usage.rolling?.resetsAt) {
        const reset = formatResetDuration(usage.rolling.resetsAt);
        if (reset) {
            lines.push(l10nFormat("5h window resets in {0}", reset));
        }
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
 * re-render the status bar text and tooltip once fresh data arrives.
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
        updateStatusBarGoUsageText(usageStatusBarItem);
        updateCumulativeTooltip(usageStatusBarItem);
        return usage;
    } finally {
        usageRefreshInFlight = false;
    }
}
