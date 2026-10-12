import type { StreamUsage } from "./commonApi";

/** Cache-hit percentage with exactly one decimal place (e.g. "83.4"). */
export function formatCacheHitRate(rate: number): string {
    return rate.toFixed(1);
}

/**
 * Compute the prompt cache-hit rate for a single request.
 *
 * The rate is `cacheHitTokens / promptTokens`, expressed as a percentage in
 * [0, 100] and rounded to one decimal place. Providers are inconsistent about
 * the cache fields, so the function is deliberately defensive:
 *
 * - no usage, no prompt tokens, or no cache-hit figure -> `null` (never NaN)
 * - non-finite / negative inputs -> `null`
 * - `cacheHitTokens > promptTokens` (providers that report the cached share on
 *   a different base) -> clamped to 100, never above
 *
 * @returns The percentage rounded to one decimal (e.g. `83.4`), or `null`
 *          when it cannot be determined.
 */
export function computeCacheHitRate(usage: StreamUsage | undefined): number | null {
    if (!usage) {
        return null;
    }
    const promptTokens = usage.promptTokens;
    const cacheHitTokens = usage.cacheHitTokens;
    if (typeof promptTokens !== "number" || typeof cacheHitTokens !== "number") {
        return null;
    }
    if (!Number.isFinite(promptTokens) || !Number.isFinite(cacheHitTokens)) {
        return null;
    }
    if (promptTokens <= 0 || cacheHitTokens < 0) {
        return null;
    }
    const rate = Math.min(100, (cacheHitTokens / promptTokens) * 100);
    // Round here so the numeric field and cacheHitRateText always agree
    // (834/1000*100 is 83.39999999999999 in IEEE 754).
    return Math.round(rate * 10) / 10;
}

/**
 * Build the `request.end` log payload for one request.
 *
 * Only logging fields are produced: nothing here touches the request body,
 * the stream handling or the token indicators. Token fields are raw numbers so
 * log consumers can aggregate them; `cacheHitRate` is the percentage number
 * (one decimal place, e.g. `83.4`) and `cacheHitRateText` is the same value
 * rendered for humans (`"83.4%"`). Both are `null` / `"n/a"` when the provider
 * did not report a cache-hit figure, so a log never contains NaN or Infinity.
 */
export function buildRequestUsageLog(
    usage: StreamUsage | undefined,
    extra: { modelId: string; durationMs: number; usageSource: "stream" | "estimated" | "none" }
): Record<string, unknown> {
    const rate = computeCacheHitRate(usage);
    return {
        modelId: extra.modelId,
        durationMs: extra.durationMs,
        inputTokens: usage ? usage.promptTokens : null,
        cachedTokens: usage?.cacheHitTokens ?? null,
        cacheMissTokens: usage?.cacheMissTokens ?? null,
        outputTokens: usage ? usage.completionTokens : null,
        cacheHitRate: rate,
        cacheHitRateText: rate === null ? "n/a" : `${formatCacheHitRate(rate)}%`,
        usageSource: extra.usageSource,
    };
}
