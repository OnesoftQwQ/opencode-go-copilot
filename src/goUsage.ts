/**
 * OpenCode Go usage fetcher.
 *
 * Fetches Go plan subscription usage from the official usage endpoint
 * (GET /zen/go/v1/usage, live since 2026-08-11, anomalyco/opencode#16513)
 * and caches it with a 5-minute TTL. Falls back to stale cache on failure
 * (silent degradation).
 *
 * The endpoint is authenticated with the same Bearer API key used for
 * inference. It reports rolling (5h), weekly (7d) and monthly utilization
 * windows plus the "useBalance" fallback flag. A missing/expired Go plan
 * surfaces as HTTP 401.
 *
 * The response shape is parsed leniently (multiple field name variants) so
 * that small upstream changes degrade gracefully instead of breaking.
 */

import { logger } from "./logger";
import { ensureModelsDevLoaded, getCatalogProviderBaseUrl } from "./modelsDev";

const FALLBACK_BASE_URL = "https://opencode.ai/zen/go/v1/";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — endpoint does a multi-table join, keep polling gentle
const FETCH_TIMEOUT_MS = 10000;

/** Outcome of the most recent usage fetch. */
export type UsageFetchStatus = "ok" | "unauthorized" | "error";

/** One usage window (rolling / weekly / monthly). */
export interface GoUsageWindow {
    /** Usage percentage of the window, 0-100. */
    percent: number;
    /** ISO timestamp when the window resets (when reported by the API). */
    resetsAt?: string;
}

/** Go plan usage snapshot. */
export interface GoUsageResult {
    /** 5-hour rolling window. */
    rolling?: GoUsageWindow;
    /** 7-day weekly window. */
    weekly?: GoUsageWindow;
    /** Monthly window. */
    monthly?: GoUsageWindow;
    /** Whether the account falls back to the Zen balance after Go quota exhaustion. */
    useBalance?: boolean;
}

// ── Module-level cache ──
let cachedUsage: GoUsageResult | null = null;
let cacheTimestamp = 0;
let lastFetchStatus: UsageFetchStatus = "error";

/**
 * Resolve the API base URL from the catalog, with fallback.
 */
async function resolveBaseUrl(): Promise<string> {
    try {
        await ensureModelsDevLoaded();
        return getCatalogProviderBaseUrl("opencode-go", FALLBACK_BASE_URL);
    } catch {
        return FALLBACK_BASE_URL;
    }
}

/**
 * Parse a single usage window object leniently.
 * Accepts percent/usagePercent/usage_percent and resetsAt/resetAt/reset_in_sec/resets_in_seconds.
 */
function parseWindow(raw: unknown): GoUsageWindow | undefined {
    if (typeof raw !== "object" || raw === null) {
        return undefined;
    }
    const obj = raw as Record<string, unknown>;
    const percentValue = obj.percent ?? obj.usagePercent ?? obj.usage_percent;
    const percent = typeof percentValue === "number" ? percentValue : Number.parseFloat(String(percentValue ?? ""));
    if (!Number.isFinite(percent) || percent < 0) {
        return undefined;
    }

    let resetsAt: string | undefined;
    const resetsAtValue = obj.resetsAt ?? obj.resetAt;
    if (typeof resetsAtValue === "string") {
        const ts = Date.parse(resetsAtValue);
        if (!Number.isNaN(ts)) {
            resetsAt = new Date(ts).toISOString();
        }
    }
    if (!resetsAt) {
        const resetInSecValue = obj.reset_in_sec ?? obj.resets_in_seconds;
        const resetInSec = typeof resetInSecValue === "number" ? resetInSecValue : Number.parseFloat(String(resetInSecValue ?? ""));
        if (Number.isFinite(resetInSec) && resetInSec > 0) {
            resetsAt = new Date(Date.now() + resetInSec * 1000).toISOString();
        }
    }

    return { percent: Math.min(Math.max(percent, 0), 100), resetsAt };
}

/**
 * Fetch Go usage from the API's /usage endpoint.
 *
 * @param apiKey - The API key for authentication.
 * @returns The parsed usage snapshot.
 * @throws Error with `status` 401 when the key is valid but there is no active Go plan.
 */
async function fetchGoUsage(apiKey: string): Promise<GoUsageResult> {
    const apiBaseUrl = await resolveBaseUrl();
    const url = `${apiBaseUrl.replace(/\/+$/, "")}/usage`;
    let response: Response;
    try {
        response = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            logger.warn("goUsage.fetch.timeout", { url });
            throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`);
        }
        throw err;
    }

    if (!response.ok) {
        const error = new Error(`Go usage error: [${response.status}] ${response.statusText}`) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }

    const body = (await response.json()) as Record<string, unknown>;
    // Lenient top-level unwrap: accept { usage: {...} }, { windows: {...} } or flat fields.
    const usageSource =
        (typeof body.usage === "object" && body.usage !== null ? body.usage : undefined) ??
        (typeof body.windows === "object" && body.windows !== null ? body.windows : undefined) ??
        body;

    const raw = usageSource as Record<string, unknown>;
    return {
        rolling: parseWindow(raw.rolling),
        weekly: parseWindow(raw.weekly),
        monthly: parseWindow(raw.monthly),
        useBalance: typeof body.useBalance === "boolean" ? body.useBalance : undefined,
    };
}

/**
 * Get the Go plan usage, refreshing the cache when it is stale.
 *
 * @param apiKey - The API key (optional; skips fetching when absent).
 * @param force - When true, always re-fetch even if the cache is fresh
 *                (used by explicit user refresh).
 * @returns The usage snapshot, or the stale cache / null on failure (silent degradation).
 */
export async function getGoUsageCached(apiKey: string | undefined, force?: boolean): Promise<GoUsageResult | null> {
    const now = Date.now();

    // Use cached result if still fresh
    if (!force && cachedUsage !== null && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedUsage;
    }

    if (!apiKey) {
        // No API key — use stale cache or return null
        return cachedUsage;
    }

    try {
        const usage = await fetchGoUsage(apiKey);
        cachedUsage = usage;
        cacheTimestamp = now;
        lastFetchStatus = "ok";
        return usage;
    } catch (err) {
        // API call failed — keep stale cache; record status for diagnostics
        lastFetchStatus = err instanceof Error && (err as Error & { status?: number }).status === 401
            ? "unauthorized"
            : "error";
        logger.warn("goUsage.fetch.failed", {
            status: lastFetchStatus,
            error: err instanceof Error ? err.message : String(err),
        });
        return cachedUsage;
    }
}

/**
 * Synchronous snapshot of the cached usage (for status bar tooltip rendering).
 */
export function getUsageSnapshot(): GoUsageResult | null {
    return cachedUsage;
}

/**
 * Status of the most recent fetch attempt.
 */
export function getUsageFetchStatus(): UsageFetchStatus {
    return lastFetchStatus;
}

/**
 * Timestamp (ms) of the most recent successful fetch, or undefined.
 */
export function getUsageFetchTimestamp(): number | undefined {
    return cacheTimestamp > 0 ? cacheTimestamp : undefined;
}

/**
 * Format an ISO reset time as a human-readable countdown, e.g. "2h 13m", "12d 5h".
 */
export function formatResetDuration(iso: string): string {
    const diffMs = new Date(iso).getTime() - Date.now();
    if (Number.isNaN(diffMs)) {
        return "";
    }
    const totalMinutes = Math.max(0, Math.ceil(diffMs / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) {
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${Math.max(minutes, 1)}m`;
}

/**
 * Format an elapsed time (ms since timestamp) as "2m", "1h 5m", "<1m".
 */
export function formatAgo(timestampMs: number): string {
    const diffMs = Date.now() - timestampMs;
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (totalMinutes < 1) {
        return "<1m";
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
}

/**
 * Build a one-line summary of the usage, e.g. "5h: 65% · 7d: 30% · 30d: 12%".
 */
export function formatUsageSummary(usage: GoUsageResult): string {
    const parts: string[] = [];
    const windows: Array<[string, GoUsageWindow | undefined]> = [
        ["5h", usage.rolling],
        ["7d", usage.weekly],
        ["30d", usage.monthly],
    ];
    for (const [label, window] of windows) {
        if (window !== undefined) {
            parts.push(`${label}: ${Math.round(window.percent)}%`);
        }
    }
    return parts.join(" \u00b7 ");
}
