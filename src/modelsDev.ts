/**
 * models.dev catalog fetcher and query engine.
 *
 * Downloads the models.dev catalog (https://models.dev/catalog.json) and provides
 * fast lookup of model metadata by ID, provider info, and provider-specific model
 * metadata. The catalog has two top-level sections:
 *
 *   - `models`:      Global model catalog keyed by fully qualified ID (e.g. "zhipuai/glm-5")
 *   - `providers`:   Provider entries keyed by provider ID, each containing:
 *       - `api`:     API base URL
 *       - `models`:  Provider-specific model metadata keyed by short ID (e.g. "glm-5")
 *
 * Used to auto-discover new models, resolve API base URLs per provider, and
 * populate model metadata (context length, max output tokens, vision, reasoning,
 * thinking modes, etc.) instead of hardcoding.
 *
 * Cached in memory for 1 minute. The short TTL keeps every extension
 * activation (and model-picker refresh) fetching a fresh catalog, while
 * still deduping the burst of concurrent activation calls VS Code fires
 * on startup. Silent degradation on failure.
 */

import { logger } from "./logger";

const CATALOG_URL = "https://models.dev/catalog.json";
const CACHE_TTL_MS = 60 * 1000; // 1 minute — dedupes concurrent startup activations

// ── Types ──

/**
 * Reasoning option descriptor from the catalog.
 */
export interface ReasoningOption {
    type: string;
    values?: string[];
    max?: number;
    min?: number;
}

/**
 * A single model entry from the catalog (used in both global `models` and
 * provider-specific `models` sections).
 */
export interface ModelsDevEntry {
    id: string;
    name?: string;
    family?: string;
    description?: string;
    reasoning?: boolean;
    reasoning_options?: ReasoningOption[];
    tool_call?: boolean;
    structured_output?: boolean;
    temperature?: boolean;
    attachment?: boolean;
    interleaved?: boolean | { field?: string };
    modalities?: {
        input?: string[];
        output?: string[];
    };
    limit?: {
        context?: number;
        output?: number;
        input?: number;
    };
    release_date?: string;
    last_updated?: string;
    status?: string;
    open_weights?: boolean;
    knowledge?: string;
    provider?: {
        npm?: string;
    };
    cost?: {
        cache_read: number;
        input: number;
        output: number;
    };
    // Additional fields may be present in provider-specific entries
    [key: string]: unknown;
}

/**
 * A provider entry from the catalog's `providers` section.
 */
export interface CatalogProvider {
    id: string;
    api: string;
    name: string;
    doc?: string;
    env?: string[];
    npm?: string;
    models: Record<string, ModelsDevEntry>;
}

/**
 * Top-level catalog structure.
 */
interface CatalogData {
    models: Record<string, ModelsDevEntry>;
    providers: Record<string, CatalogProvider>;
}

// ── Module-level cache ──

/** Map from global catalog fully qualified ID to entry. */
let metadataMap: Map<string, ModelsDevEntry> | null = null;
/** Map from short ID (last segment after slash) to global entry. */
let shortIdMap: Map<string, ModelsDevEntry> | null = null;
/** Provider catalog keyed by provider ID. */
let providersMap: Map<string, CatalogProvider> | null = null;
let cacheTimestamp = 0;
/** Whether the last fetch attempt succeeded. Used to retry sooner after failure. */
let lastLoadFailed = false;

// ── Internal helpers ──

/**
 * Fetch the catalog JSON.
 */
async function fetchCatalog(): Promise<CatalogData> {
    try {
        const response = await fetch(CATALOG_URL, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            throw new Error(`catalog error: [${response.status}] ${response.statusText}`);
        }
        return (await response.json()) as CatalogData;
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            logger.warn("modelsDev.fetch.timeout", { url: CATALOG_URL });
            throw new Error(`Request timed out after 10000ms`);
        }
        throw err;
    }
}

function rebuildIndex(data: CatalogData): void {
    // Index global model catalog
    metadataMap = new Map();
    shortIdMap = new Map();

    for (const [fullId, entry] of Object.entries(data.models)) {
        metadataMap.set(fullId, entry);
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

    // Index provider catalog
    providersMap = new Map();
    for (const [providerId, provider] of Object.entries(data.providers)) {
        providersMap.set(providerId, provider);
    }
}

// ── Provider-specific lookup ──

/**
 * Get a provider entry from the catalog by provider ID.
 * @param providerId - Provider ID (e.g. "opencode-go", "opencode")
 */
export function getCatalogProvider(providerId: string): CatalogProvider | undefined {
    return providersMap?.get(providerId);
}

/**
 * Get the API base URL for a provider from the catalog.
 * @param providerId - Provider ID (e.g. "opencode-go", "opencode")
 * @param fallbackUrl - Fallback URL if catalog is not loaded or provider not found
 */
export function getCatalogProviderBaseUrl(providerId: string, fallbackUrl: string): string {
    const provider = providersMap?.get(providerId);
    if (provider?.api) {
        return provider.api.replace(/\/+$/, "") + "/";
    }
    return fallbackUrl;
}

/**
 * Get provider-specific model metadata from the catalog.
 * Looks up the model in the specified provider's models section.
 *
 * @param providerId - Provider ID (e.g. "opencode-go", "opencode")
 * @param modelId - Short model ID (e.g. "glm-5", "deepseek-v4-flash")
 * @returns The provider-specific model entry, or undefined if not found.
 */
export function getCatalogProviderModelEntry(
    providerId: string,
    modelId: string
): ModelsDevEntry | undefined {
    return providersMap?.get(providerId)?.models?.[modelId];
}

/**
 * Get all model IDs served by a provider from the catalog.
 * Returns an empty array if the catalog is not loaded or the provider is unknown.
 *
 * @param providerId - Provider ID (e.g. "opencode-go", "opencode")
 */
export function getCatalogProviderModelIds(providerId: string): string[] {
    const models = providersMap?.get(providerId)?.models;
    return models ? Object.keys(models) : [];
}

// ── Inference helpers ──

/**
 * Infer the thinking mode from a catalog model entry.
 *
 * - `reasoning: false` or missing → `"always"` (no thinking at all)
 * - `reasoning_options` is empty or missing → `"always"` (thinking always on, no user control)
 * - `reasoning_options` has entries → `"switchable"` (user can toggle)
 */
export function inferThinkingMode(entry: ModelsDevEntry): "switchable" | "always" | "adaptive" {
    if (!entry.reasoning) return "always";
    const opts = entry.reasoning_options;
    if (!opts || opts.length === 0) return "always";
    return "switchable";
}

/**
 * Extract supported reasoning effort values from a catalog model entry.
 * Returns undefined if no explicit effort values are defined (simple on/off).
 */
export function inferReasoningEfforts(entry: ModelsDevEntry): string[] | undefined {
    const opts = entry.reasoning_options;
    if (!opts) return undefined;
    for (const opt of opts) {
        if (opt.type === "effort" && opt.values && opt.values.length > 0) {
            return opt.values;
        }
    }
    return undefined;
}

/**
 * Infer the default reasoning effort from a catalog model entry.
 * Returns the last (highest) effort value, or "enabled" if no effort values.
 */
export function inferDefaultReasoningEffort(entry: ModelsDevEntry): string {
    const efforts = inferReasoningEfforts(entry);
    if (efforts && efforts.length > 0) return efforts[efforts.length - 1];
    return "enabled";
}

/**
 * Check if a model has vision capability from its catalog entry.
 */
export function inferVision(entry: ModelsDevEntry): boolean {
    if (entry.attachment === true) return true;
    const input = entry.modalities?.input;
    if (input && (input.includes("image") || input.includes("video"))) return true;
    return false;
}

/**
 * Extract the thinking budget range from a catalog model entry.
 * Returns undefined if no `budget_tokens` reasoning option is defined.
 */
export function inferThinkingBudget(entry: ModelsDevEntry): { min?: number; max?: number } | undefined {
    const opts = entry.reasoning_options;
    if (!opts) return undefined;
    for (const opt of opts) {
        if (opt.type === "budget_tokens") {
            const result: { min?: number; max?: number } = {};
            if (typeof opt.min === "number") result.min = opt.min;
            if (typeof opt.max === "number") result.max = opt.max;
            return result;
        }
    }
    return undefined;
}

// ── Public API ──

/**
 * Ensure the models.dev catalog is loaded and cached.
 * Silently degrades on failure — existing cache is preserved.
 */
export async function ensureModelsDevLoaded(): Promise<void> {
    const now = Date.now();

    // Fresh cache within TTL — skip fetch (dedupes the startup activation burst)
    if (!lastLoadFailed && metadataMap !== null && now - cacheTimestamp < CACHE_TTL_MS) {
        return;
    }

    // Failed load — respect minimum retry interval (1 minute)
    if (lastLoadFailed && metadataMap !== null && now - cacheTimestamp < 60000) {
        return;
    }

    try {
        const data = await fetchCatalog();
        rebuildIndex(data);
        cacheTimestamp = now;
        lastLoadFailed = false;
    } catch {
        if (metadataMap === null) {
            metadataMap = new Map();
            shortIdMap = new Map();
            providersMap = new Map();
        }
        cacheTimestamp = now;
        lastLoadFailed = true;
    }
}

/**
 * Look up a model's metadata by its API model ID from the global catalog.
 *
 * Matching strategy (in order):
 * 1. Exact match on the full models.dev ID
 * 2. Short ID match (last segment after '/')
 * 3. Suffix match
 *
 * @param apiModelId - The model ID as returned by the API (e.g. "deepseek-v4-flash")
 * @returns The global catalog entry, or undefined if not found.
 */
export function lookupModelDevEntry(apiModelId: string): ModelsDevEntry | undefined {
    if (!metadataMap) return undefined;

    if (metadataMap.has(apiModelId)) return metadataMap.get(apiModelId);
    if (shortIdMap?.has(apiModelId)) return shortIdMap.get(apiModelId);

    for (const [fullId, entry] of metadataMap) {
        if (fullId.endsWith(`/${apiModelId}`) || fullId === apiModelId) return entry;
    }

    return undefined;
}

/**
 * Check whether a given API model ID exists in the global catalog.
 */
export function hasModelDevEntry(apiModelId: string): boolean {
    return lookupModelDevEntry(apiModelId) !== undefined;
}

/**
 * Deduce API mode (openai vs anthropic) from a model ID and optional catalog entry.
 * Uses family-based heuristics since the catalog does not directly expose apiMode.
 *
 * Also checks the `provider.npm` field: @ai-sdk/anthropic → anthropic.
 */
export function deduceApiModeFromFamily(modelId: string, entry?: ModelsDevEntry): "openai" | "anthropic" {
    // Check provider npm hint first
    if (entry?.provider?.npm?.includes("anthropic")) return "anthropic";

    const family = entry?.family?.toLowerCase() ?? "";
    if (family.includes("claude") || family.includes("anthropic")) return "anthropic";
    if (family.includes("qwen")) {
        if (/qwen[\s-]*3\.[67]/i.test(modelId)) return "anthropic";
        return "openai";
    }
    if (family.includes("gemma")) return "anthropic";
    return "openai";
}

/**
 * Clear the cached metadata (for testing / manual refresh).
 */
export function clearModelsDevCache(): void {
    metadataMap = null;
    shortIdMap = null;
    providersMap = null;
    cacheTimestamp = 0;
    lastLoadFailed = false;
}
