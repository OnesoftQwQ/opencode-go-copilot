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
 * on startup. On failure the fetch falls back to a configurable mirror URL
 * (opencodego.modelsDevMirrorUrl), then to a hardcoded catalog snapshot.
 */

import * as vscode from "vscode";
import { HARDCODED_CATALOG } from "./hardcodedModelList";
import { logger } from "./logger";
import type { ApiMode } from "./types";

const CATALOG_URL = "https://models.dev/catalog.json";
const CACHE_TTL_MS = 60 * 1000; // 1 minute — dedupes concurrent startup activations
const OFFICIAL_TIMEOUT_MS = 10 * 1000;
const MIRROR_TIMEOUT_MS = 30 * 1000;
/** Value sent in the `platform` header to mirrors that require it. */
const MIRROR_PLATFORM_HEADER = "opencode-go-copilot";

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
 * Mirror configuration from the `opencodego` settings.
 * Accepts the full catalog URL or a base URL ending with "/".
 */
function getMirrorConfig(): { url?: string; token?: string } {
    const cfg = vscode.workspace.getConfiguration("opencodego");
    const rawUrl = cfg.get<string>("modelsDevMirrorUrl", "")?.trim();
    if (!rawUrl) return {};
    return {
        url: rawUrl.endsWith("/") ? `${rawUrl}catalog.json` : rawUrl,
        token: cfg.get<string>("modelsDevMirrorToken", "")?.trim() || undefined,
    };
}

/** Source of the loaded catalog data. */
export type CatalogSource = "official" | "mirror" | "hardcoded";

interface FetchCatalogResult {
    data: CatalogData;
    source: CatalogSource;
}

/**
 * Fetch JSON with a timeout, converting abort into a plain error.
 * Returns the parsed catalog plus the raw payload size in bytes.
 */
async function fetchJson(
    url: string,
    timeoutMs: number,
    headers?: Record<string, string>
): Promise<{ data: CatalogData; bytes: number }> {
    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(timeoutMs),
            headers,
        });
        if (!response.ok) {
            throw new Error(`catalog error: [${response.status}] ${response.statusText}`);
        }
        const text = await response.text();
        return { data: JSON.parse(text) as CatalogData, bytes: text.length };
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            logger.warn("modelsDev.fetch.timeout", { url, timeoutMs });
            throw new Error(`Request timed out after ${timeoutMs}ms`);
        }
        throw err;
    }
}

/**
 * Fetch the catalog JSON. Fallback chain: official models.dev URL → configured
 * mirror (with platform/token headers) → hardcoded catalog snapshot.
 */
async function fetchCatalog(): Promise<FetchCatalogResult> {
    const officialStart = Date.now();
    try {
        const { data, bytes } = await fetchJson(CATALOG_URL, OFFICIAL_TIMEOUT_MS);
        logger.info("modelsDev.fetch.official", {
            url: CATALOG_URL,
            durationMs: Date.now() - officialStart,
            bytes,
        });
        return { data, source: "official" };
    } catch (err) {
        logger.warn("modelsDev.fetch.officialFailed", {
            url: CATALOG_URL,
            durationMs: Date.now() - officialStart,
            error: err instanceof Error ? err.message : String(err),
        });
    }

    const mirror = getMirrorConfig();
    if (mirror.url) {
        const mirrorStart = Date.now();
        try {
            const headers: Record<string, string> = { platform: MIRROR_PLATFORM_HEADER };
            if (mirror.token) {
                headers["x-mirror-token"] = mirror.token;
            }
            const { data, bytes } = await fetchJson(mirror.url, MIRROR_TIMEOUT_MS, headers);
            logger.info("modelsDev.fetch.mirror", {
                url: mirror.url,
                durationMs: Date.now() - mirrorStart,
                bytes,
            });
            return { data, source: "mirror" };
        } catch (err) {
            logger.warn("modelsDev.fetch.mirrorFailed", {
                url: mirror.url,
                durationMs: Date.now() - mirrorStart,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    logger.warn("modelsDev.fetch.hardcoded", {
        providers: Object.keys(HARDCODED_CATALOG.providers),
    });
    return { data: HARDCODED_CATALOG, source: "hardcoded" };
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
 * - `reasoning_options` has entries → `"switchable"` (user can toggle / pick effort)
 *
 * Note: whether a model accepts an explicit off switch (`effort: "none"`) on a
 * given protocol is a separate concern; that capability is exposed through
 * `inferSupportsDisablingReasoning()` (used by the Responses adapter), so the
 * generic thinking mode keeps the pre-existing semantics for Chat/Anthropic
 * protocols (which disable thinking via `thinking: { type: "disabled" }`, not
 * via an effort value).
 */
export function inferThinkingMode(entry: ModelsDevEntry): "switchable" | "always" | "adaptive" {
    if (!entry.reasoning) return "always";
    const opts = entry.reasoning_options;
    if (!opts || opts.length === 0) return "always";
    return "switchable";
}

/**
 * Whether the catalog declares that the model can accept an explicit off
 * value for reasoning effort (`"none"` / `"disabled"`).
 *
 * - effort list includes `none`/`disabled` → `true`
 * - toggle-style option (simple on/off) → `true`
 * - effort list omits a disabled value → `false`
 * - no reasoning options at all → `false`
 *
 * This is used ONLY by the OpenAI Responses protocol adapter: sending
 * `reasoning.effort: "none"` to a Responses model that does not declare such a
 * value can be rejected by the endpoint. Chat Completions / Anthropic
 * protocols disable thinking independently of this (via `thinking` flags).
 */
export function inferSupportsDisablingReasoning(entry: ModelsDevEntry): boolean {
    const opts = entry.reasoning_options;
    if (!opts || opts.length === 0 || !entry.reasoning) return false;
    for (const opt of opts) {
        if (opt.type === "effort" && opt.values?.length) {
            return opt.values.some((value) => value === "none" || value === "disabled");
        }
        if (opt.type === "toggle") {
            return true;
        }
    }
    return false;
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
 * Log a one-line summary of a catalog load attempt: which source won, how
 * long the whole fallback chain took, and how much data is indexed. When no
 * fresh data was loaded (hardcoded fallback keeping existing cache, or total
 * failure), counts are read from the in-memory index instead.
 * Fallback sources (mirror/hardcoded) and total failure are logged as
 * warnings so they stand out in the output channel.
 */
function logLoadSummary(source: CatalogSource | "failed", start: number, data: CatalogData | null): void {
    const countProviderModels = (providerId: string): number => {
        if (data?.providers?.[providerId]?.models) {
            return Object.keys(data.providers[providerId].models).length;
        }
        const entry = providersMap?.get(providerId);
        return entry?.models ? Object.keys(entry.models).length : 0;
    };
    const payload = {
        source,
        durationMs: Date.now() - start,
        providers: data ? Object.keys(data.providers ?? {}).length : (providersMap?.size ?? 0),
        goModels: countProviderModels("opencode-go"),
        zenModels: countProviderModels("opencode"),
    };
    if (source === "official") {
        logger.info("modelsDev.load", payload);
    } else {
        logger.warn("modelsDev.load", payload);
    }
}

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

    const start = Date.now();
    try {
        const { data, source } = await fetchCatalog();
        if (source === "hardcoded" && metadataMap !== null) {
            // Keep the previously fetched catalog — it is fresher than the
            // hardcoded list. Only the retry timing is updated.
            cacheTimestamp = now;
            lastLoadFailed = true;
            logLoadSummary("hardcoded", start, null);
            return;
        }
        rebuildIndex(data);
        cacheTimestamp = now;
        lastLoadFailed = source !== "official";
        logLoadSummary(source, start, data);
    } catch {
        // Both sources failed and the hardcoded list is unavailable; keep any
        // existing data and retry later. Should not normally happen.
        if (metadataMap === null) {
            metadataMap = new Map();
            shortIdMap = new Map();
            providersMap = new Map();
        }
        cacheTimestamp = now;
        lastLoadFailed = true;
        logLoadSummary("failed", start, null);
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
 * Resolve the request protocol from the models.dev adapter package.
 * The provider-specific model override is selected by the caller before the
 * provider-wide default. Family heuristics are retained only for legacy or
 * incomplete catalogs that do not expose a recognized adapter package.
 */
export function deduceApiModeFromCatalog(
    modelId: string,
    adapterNpm?: string,
    entry?: ModelsDevEntry
): ApiMode {
    switch (adapterNpm) {
        case "@ai-sdk/openai":
            return "openai-responses";
        case "@ai-sdk/anthropic":
            return "anthropic";
        case "@ai-sdk/openai-compatible":
            return "openai";
    }

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
