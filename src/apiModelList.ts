/**
 * API model list fetcher.
 *
 * Fetches the list of available model IDs from the OpenCode Go API
 * (GET https://opencode.ai/zen/go/v1/models) and caches it with a 1-minute
 * TTL. Falls back to stale cache or an empty list on failure (silent
 * degradation).
 *
 * The control-plane base is fixed rather than resolved from the models.dev
 * catalog: the catalog's "opencode-go" provider API now points at a
 * protocol-specific inference route that has no /models route (#144).
 */

import { OFFICIAL_CONTROL_PLANE_BASE_URL } from "./endpoints";
import { logger } from "./logger";

const CACHE_TTL_MS = 60 * 1000; // 1 minute — short TTL dedupes concurrent startup activations

// ── Module-level cache ──
let cachedModelIds: string[] | null = null;
let cacheTimestamp = 0;
let lastFetchSuccess = false;

/**
 * Fetch the model ID list from the API's /models endpoint.
 * The endpoint follows OpenAI /v1/models format:
 *   { object: "list", data: [{ id: string, object: string, created: number, owned_by: string }, ...] }
 */
async function fetchApiModelList(apiKey: string): Promise<string[]> {
    const url = `${OFFICIAL_CONTROL_PLANE_BASE_URL.replace(/\/+$/, "")}/models`;
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            throw new Error(`API model list error: [${response.status}] ${response.statusText}`);
        }
        const body = (await response.json()) as { data?: Array<{ id: string }> };
        return (body.data ?? []).map((m) => m.id);
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            logger.warn("apiModelList.fetch.timeout", { url });
            // Throw a regular error so caller's catch block preserves stale cache
            throw new Error(`Request timed out after 10000ms`);
        }
        throw err;
    }
}

/**
 * Get the list of model IDs available via the OpenCode Go API.
 *
 * @param apiKey - The API key for authentication.
 * @returns A set of model ID strings available on the API server.
 *          Returns an empty set on failure (silent degradation).
 */
export async function getApiModelIds(apiKey: string | undefined): Promise<Set<string>> {
    const now = Date.now();


    // Use cached result if still fresh
    if (cachedModelIds !== null && now - cacheTimestamp < CACHE_TTL_MS) {
        return new Set(cachedModelIds);
    }

    if (!apiKey) {
        // No API key — use stale cache or return empty
        if (cachedModelIds !== null) {
            return new Set(cachedModelIds);
        }
        return new Set();
    }

    try {
        // TODO: Consider filtering model IDs against the models.dev catalog.
        // As of 2026-07-30, hy3-preview is wrongly listed as a valid Go model
        // (calls fail, and it is absent from the catalog), so the catalog
        // could serve as a source of truth for valid model IDs.
        const ids = await fetchApiModelList(apiKey);
        cachedModelIds = ids;
        cacheTimestamp = now;
        lastFetchSuccess = true;
        return new Set(ids);
    } catch {
        // API call failed — use stale cache if available
        lastFetchSuccess = false;
        if (cachedModelIds !== null) {
            return new Set(cachedModelIds);
        }
        return new Set();
    }
}

/**
 * Returns true if the most recent API model list fetch was successful.
 * Used by the model provider to decide whether to apply API-based filtering.
 */
export function isApiFetchSuccessful(): boolean {
    return lastFetchSuccess;
}

/**
 * Clear the cached API model list (for testing / manual refresh).
 */
export function clearApiModelCache(): void {
    cachedModelIds = null;
    cacheTimestamp = 0;
    lastFetchSuccess = false;
}
