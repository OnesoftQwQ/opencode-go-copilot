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
// Cumulative cost in USD (reset together with the token counters above)
let cumulativeCost = 0;
let cumulativeSaved = 0;
// Most recent API call's cache hit rate (updated on every usage report)
let lastUsageHitRate: number | undefined;
let prevUsageHitRate: number | undefined;

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
 * Update the status bar main text with the Go plan usage (5h window) and
 * the overall cache hit rate, e.g. "$(symbol-numeric) 5H:65%,Hit:99%", or
 * "$(symbol-numeric) Go --" while no usage data is available.
 */
function updateStatusBarGoUsageText(statusBarItem: vscode.StatusBarItem): void {
    const usage = getUsageSnapshot();
    const percent = usage?.rolling?.percent;
    const totalCache = cumulativeCacheHitTokens + cumulativeCacheMissTokens;
    const parts: string[] = [];
    if (percent !== undefined) {
        parts.push(`5H:${Math.round(percent)}%`);
    }
    if (totalCache > 0) {
        parts.push(`Hit:${Math.round((cumulativeCacheHitTokens / totalCache) * 100)}%`);
    }
    statusBarItem.text = parts.length > 0
        ? `$(symbol-numeric) ${parts.join(",")}`
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
    cumulativeCost = 0;
    cumulativeSaved = 0;
}

/**
 * Model cost information (USD per 1M tokens).
 */
export interface ModelCost {
    cache_read: number;
    input: number;
    output: number;
}

/**
 * Record streaming usage data into cumulative counters.
 * Cost accounting follows the same formula as opencode's session tracker:
 * tokens × price / 1e6, summed over input, output and cache-read tokens.
 * Savings = cache-hit tokens × (input price − cache-read price).
 */
export function recordUsage(usage: StreamUsage, cost?: ModelCost): void {
    cumulativeInputTokens += usage.promptTokens;
    cumulativeOutputTokens += usage.completionTokens;
    if (usage.cacheHitTokens !== undefined) {
        cumulativeCacheHitTokens += usage.cacheHitTokens;
    }
    if (usage.cacheMissTokens !== undefined) {
        cumulativeCacheMissTokens += usage.cacheMissTokens;
    }
    // Track the most recent API call's cache hit rate (for the tooltip)
    if (usage.cacheHitTokens !== undefined && usage.cacheMissTokens !== undefined) {
        const callTotal = usage.cacheHitTokens + usage.cacheMissTokens;
        if (callTotal > 0) {
            prevUsageHitRate = lastUsageHitRate;
            lastUsageHitRate = (usage.cacheHitTokens / callTotal) * 100;
        }
    }
    if (cost) {
        const cacheHit = usage.cacheHitTokens ?? 0;
        const cacheMiss = usage.cacheMissTokens ?? 0;
        cumulativeCost +=
            (usage.promptTokens * cost.input) / 1_000_000 +
            (usage.completionTokens * cost.output) / 1_000_000 +
            (cacheHit * cost.cache_read) / 1_000_000 +
            (cacheMiss * cost.input) / 1_000_000;
        cumulativeSaved += (cacheHit * (cost.input - cost.cache_read)) / 1_000_000;
    }
}

/**
 * Append the OpenCode Go plan usage section to the tooltip rows.
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
        lines.push(`<div>${label}——${Math.round(window.percent)}%</div>`);
    }
    if (usage.rolling?.resetsAt) {
        const reset = formatResetDuration(usage.rolling.resetsAt);
        if (reset) {
            lines.push(`<div>${l10nFormat("5h window resets in {0}", reset)}</div>`);
        }
    }
}

/**
 * Render a continuous pill progress bar as HTML (theme-aware).
 * A filled green segment followed by a muted empty segment, both rendered as
 * solid color blocks via span background-color (the only visual styles
 * allowed by VS Code's markdown sanitizer). The segments are filled with
 * invisible &nbsp; so the result is one continuous bar — no glyphs, no gaps.
 */
function renderProgressBar(percent: number): string {
    const clamped = Math.max(0, Math.min(100, percent));
    const totalUnits = 20; // 20 invisible units → 5% per unit
    const filled = Math.round((clamped / 100) * totalUnits);
    const empty = totalUnits - filled;
    const nbsp = "\u00A0";
    let html = "";
    if (filled > 0) {
        // NOTE: the sanitizer regex requires every style declaration to end
        // with a semicolon, otherwise the whole style attr is stripped.
        html += `<span style="background-color:var(--vscode-charts-green);">${nbsp.repeat(filled)}</span>`;
    }
    if (empty > 0) {
        html += `<span style="background-color:var(--vscode-descriptionForeground);">${nbsp.repeat(empty)}</span>`;
    }
    return html;
}

/**
 * Format a USD amount, trimming trailing zeros (e.g. 0.102, 0.0097).
 */
function formatUsd(value: number): string {
    return Number(value.toFixed(4)).toString();
}

/**
 * Update the status bar tooltip with cache hit rates, token details,
 * cost/savings (if model cost data is available) and OpenCode Go plan
 * usage (if enabled and data is cached).
 *
 * The tooltip is a MarkdownString with supportHtml enabled, so the progress
 * bars and cost rows render as rich HTML (theme-colored, like a modern UI)
 * instead of plain text. All HTML stays within VS Code's sanitizer
 * allow-list (div/span/strong + span style color with --vscode-* vars).
 */
export function updateCumulativeTooltip(statusBarItem: vscode.StatusBarItem): void {
    const rows: string[] = [];

    // Most recent API call hit rate, with delta vs the previous call
    if (lastUsageHitRate !== undefined) {
        rows.push(`<div><strong>${l10n("Hit rate (last call)")}</strong></div>`);
        let deltaHtml = "";
        if (prevUsageHitRate !== undefined) {
            const delta = lastUsageHitRate - prevUsageHitRate;
            const arrow = delta >= 0 ? "\u2191" : "\u2193";
            const deltaColor = delta >= 0 ? "var(--vscode-charts-green)" : "var(--vscode-charts-red)";
            deltaHtml = ` <span style="color:${deltaColor}">${arrow}${Math.abs(delta).toFixed(1)}%</span>`;
        }
        rows.push(`<div>${renderProgressBar(lastUsageHitRate)} ${lastUsageHitRate.toFixed(1)}%${deltaHtml}</div>`);
    }

    // Total hit rate (session cumulative)
    const totalCache = cumulativeCacheHitTokens + cumulativeCacheMissTokens;
    if (totalCache > 0) {
        const totalPercent = (cumulativeCacheHitTokens / totalCache) * 100;
        rows.push(
            `<div><strong>${l10n("Total hit rate")}:</strong></div>`,
            `<div>${renderProgressBar(totalPercent)} ${totalPercent.toFixed(1)}%</div>`
        );
    }

    // Token details (session cumulative): total input = cache hit + miss
    if (cumulativeCacheHitTokens > 0 || cumulativeCacheMissTokens > 0) {
        rows.push(
            `<div>${l10n("Input")}: ${formatTokenCount(cumulativeCacheHitTokens + cumulativeCacheMissTokens)} tok &nbsp;&nbsp;&nbsp;&nbsp;(${formatTokenCount(cumulativeCacheHitTokens)}+${formatTokenCount(cumulativeCacheMissTokens)})</div>`
        );
    }
    rows.push(`<div>${l10n("Output")}: ${cumulativeOutputTokens.toLocaleString()} tok</div>`);

    // Cost & savings (only shown when model cost data was provided)
    if (cumulativeCost > 0 || cumulativeSaved > 0) {
        rows.push(
            `<div>${l10n("Total saved")}: <span style="color:var(--vscode-charts-green)">~$${formatUsd(cumulativeSaved)}</span></div>`,
            `<div>${l10n("Cost")}: <span style="color:var(--vscode-charts-yellow)">$${formatUsd(cumulativeCost)}</span></div>`
        );
    }

    // Section 3: OpenCode Go plan usage (optional)
    appendGoUsageTooltipLines(rows);

    const md = new vscode.MarkdownString("", true);
    md.supportHtml = true;
    md.appendMarkdown(rows.join(""));
    statusBarItem.tooltip = md;
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
