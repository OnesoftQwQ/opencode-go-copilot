/**
 * Models.dev metadata fetcher and query engine.
 *
 * Downloads the models.dev catalog (https://models.dev/models.json) and provides
 * fast lookup of model metadata by ID. Used to auto-discover new models that
 * appear in the API model list but are not yet in the hardcoded built-in list.
 *
 * The metadata includes context length, max output tokens, vision support,
 * reasoning capability, tool calling support, temperature support, etc.
 *
 * Cached in memory for 1 hour. Silent degradation on failure.
 */

import { logger } from "./logger";

const MODELS_DEV_URL = "https://models.dev/models.json";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Types ──

/**
 * A single entry from models.dev/models.json.
 */
export interface ModelsDevEntry {
    id: string;
    name?: string;
    family?: string;
    reasoning?: boolean;
    tool_call?: boolean;
    structured_output?: boolean;
    temperature?: boolean;
    attachment?: boolean;
    modalities?: {
        input?: string[];
        output?: string[];
    };
    limit?: {
        context?: number;
        output?: number;
        input?: number;
    };
}

// ── Module-level cache ──

/** Map from models.dev fully qualified ID to entry. */
let metadataMap: Map<string, ModelsDevEntry> | null = null;
/** Map from short ID (last segment after slash) to entry. */
let shortIdMap: Map<string, ModelsDevEntry> | null = null;
let cacheTimestamp = 0;

// ── Internal helpers ──

/**
 * Fetch the full models.dev catalog JSON.
 */
async function fetchModelsDevCatalog(): Promise<Record<string, ModelsDevEntry>> {
    try {
        const response = await fetch(MODELS_DEV_URL, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            throw new Error(`models.dev error: [${response.status}] ${response.statusText}`);
        }
        return (await response.json()) as Record<string, ModelsDevEntry>;
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            logger.warn("modelsDev.fetch.timeout", { url: MODELS_DEV_URL });
            // Throw a regular error so caller preserves existing cache
            throw new Error(`Request timed out after 10000ms`);
        }
        throw err;
    }
}

function rebuildIndex(data: Record<string, ModelsDevEntry>): void {
    metadataMap = new Map();
    shortIdMap = new Map();

    for (const [fullId, entry] of Object.entries(data)) {
        metadataMap.set(fullId, entry);
        // Also index by the short name (last segment after '/')
        const slashIdx = fullId.lastIndexOf("/");
        if (slashIdx >= 0) {
            const shortId = fullId.slice(slashIdx + 1);
            if (!shortIdMap.has(shortId)) {
                shortIdMap.set(shortId, entry);
            } else {
                logger.warn("modelsDev.index.collision", {
                    shortId,
                    existing: shortIdMap.get(shortId)!.id,
                    ignored: entry.id,
                });
            }
        }
    }
}

// ── Public API ──

/**
 * Ensure the models.dev catalog is loaded and cached.
 * Silently degrades on failure — existing cache is preserved.
 */
export async function ensureModelsDevLoaded(): Promise<void> {
    const now = Date.now();

    // Already loaded and fresh
    if (metadataMap !== null && now - cacheTimestamp < CACHE_TTL_MS) {
        return;
    }

    // Use stale cache if recent enough (within 2x TTL)
    if (metadataMap !== null && now - cacheTimestamp < CACHE_TTL_MS * 2) {
        cacheTimestamp = now; // Bump timestamp to reduce retry frequency
        return;
    }

    try {
        const data = await fetchModelsDevCatalog();
        rebuildIndex(data);
        cacheTimestamp = now;
    } catch {
        // Silent degradation — keep existing cache if any
        if (metadataMap === null) {
            // No data at all — initialize empty maps
            metadataMap = new Map();
            shortIdMap = new Map();
            cacheTimestamp = now;
        }
    }
}

/**
 * Look up a model's metadata by its API model ID.
 *
 * Matching strategy (in order):
 * 1. Exact match on the full models.dev ID
 * 2. Short ID match (last segment after '/')
 * 3. Direct match on the API ID itself
 *
 * @param apiModelId - The model ID as returned by the API (e.g. "deepseek-v4-flash")
 * @returns The models.dev entry, or undefined if not found.
 */
export function lookupModelDevEntry(apiModelId: string): ModelsDevEntry | undefined {
    if (!metadataMap) {
        return undefined;
    }

    // 1. Direct match on full ID
    if (metadataMap.has(apiModelId)) {
        return metadataMap.get(apiModelId);
    }

    // 2. Short ID match
    if (shortIdMap?.has(apiModelId)) {
        return shortIdMap.get(apiModelId);
    }

    // 3. Try suffix match: some API IDs might be prefix of the full path
    for (const [fullId, entry] of metadataMap) {
        if (fullId.endsWith(`/${apiModelId}`) || fullId === apiModelId) {
            return entry;
        }
    }

    return undefined;
}

/**
 * Check whether a given API model ID exists in the models.dev catalog.
 */
export function hasModelDevEntry(apiModelId: string): boolean {
    return lookupModelDevEntry(apiModelId) !== undefined;
}

/**
 * Deduce API mode (openai vs anthropic) from a model ID and optional models.dev entry.
 * Uses family-based heuristics since models.dev does not directly expose apiMode.
 */
export function deduceApiModeFromFamily(modelId: string, entry?: ModelsDevEntry): "openai" | "anthropic" {
    const family = entry?.family?.toLowerCase() ?? "";
    if (family.includes("claude") || family.includes("anthropic")) {
        return "anthropic";
    }
    if (family.includes("qwen")) {
        if (/qwen[\s-]*3\.[67]/i.test(modelId)) {
            return "anthropic";
        }
        return "openai";
    }
    if (family.includes("gemma")) {
        return "anthropic";
    }
    return "openai";
}

/**
 * Clear the cached metadata (for testing / manual refresh).
 */
export function clearModelsDevCache(): void {
    metadataMap = null;
    shortIdMap = null;
    cacheTimestamp = 0;
}
