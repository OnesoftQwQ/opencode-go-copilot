import * as vscode from "vscode";
import type { LanguageModelChatInformation } from "vscode";
import type { OpenCodeGoModelItem } from "../types";
import { l10n } from "../localize";
import { logger } from "../logger";
import {
    ensureModelsDevLoaded,
    lookupModelDevEntry,
    deduceApiModeFromFamily,
    getCatalogProviderBaseUrl,
    getCatalogProviderModelEntry,
    inferThinkingMode,
    inferReasoningEfforts,
    inferDefaultReasoningEffort,
    inferVision,
    type ModelsDevEntry,
} from "../modelsDev";

const ZEN_PROVIDER_ID = "opencode";
const ZEN_FALLBACK_BASE_URL = "https://opencode.ai/zen/v1/";

/**
 * Minimal overrides for Zen free models that the catalog may not fully cover.
 * Only use for edge cases where the catalog data is incorrect or incomplete.
 */
const ZEN_MODEL_OVERRIDES: Record<string, Partial<{
    displayName: string;
    contextLength: number;
    vision: boolean;
    maxTokens: number;
    thinkingMode: "switchable" | "always" | "adaptive";
    supportedReasoningEfforts?: string[];
    defaultReasoningEffort?: string;
    apiMode?: "openai" | "anthropic";
    cost?: { cache_read: number; input: number; output: number };
}>> = {};

const EXTENSION_LABEL_ZEN = "OpenCode Zen";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Module-level cache for Zen model list ──
let cachedModelIds: string[] | null = null;
let cacheTimestamp = 0;
let cachedBaseUrl: string | null = null;

/**
 * Resolve the Zen API base URL from the catalog, with fallback.
 */
async function resolveZenBaseUrl(): Promise<string> {
    if (cachedBaseUrl) return cachedBaseUrl;
    try {
        await ensureModelsDevLoaded();
        cachedBaseUrl = getCatalogProviderBaseUrl(ZEN_PROVIDER_ID, ZEN_FALLBACK_BASE_URL);
    } catch {
        cachedBaseUrl = ZEN_FALLBACK_BASE_URL;
    }
    return cachedBaseUrl;
}

/**
 * Fetch the full model list from OpenCode Zen API.
 * The endpoint follows OpenAI /v1/models format:
 *   { object: "list", data: [{ id: string, object: string, created: number, owned_by: string }, ...] }
 */
async function fetchZenModelList(apiKey: string): Promise<string[]> {
    const baseUrl = await resolveZenBaseUrl();
    const url = `${baseUrl.replace(/\/+$/, "")}/models`;
    const TIMEOUT_MS = 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`Zen API error: [${response.status}] ${response.statusText}`);
        }
        const body = (await response.json()) as { data?: Array<{ id: string }> };
        return (body.data ?? []).map((m) => m.id);
    } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === "AbortError") {
            logger.warn("zen.fetch.timeout", { url });
        }
        throw err;
    }
}

/**
 * Merge model metadata with precedence: overrides > catalog provider entry > global catalog entry > defaults.
 */
function resolveZenMetadata(modelId: string) {
    const override = ZEN_MODEL_OVERRIDES[modelId];
    const providerEntry = getCatalogProviderModelEntry(ZEN_PROVIDER_ID, modelId);
    const globalEntry = lookupModelDevEntry(modelId);

    // Prefer provider-specific entry, fall back to global entry
    const entry = providerEntry ?? globalEntry;
    const isDeprecated = entry?.status === "deprecated";
    const rawName = override?.displayName ?? entry?.name ?? modelId;
    const displayName = `[Zen] ${isDeprecated ? "[Depr] " : ""}${rawName}`;
    const status = entry?.status;
    const contextLength = override?.contextLength ?? entry?.limit?.context ?? 128000;
    const maxTokens = override?.maxTokens ?? entry?.limit?.output ?? 4096;
    const vision = override?.vision ?? (entry ? inferVision(entry) : false);
    const thinkingMode = override?.thinkingMode ?? (entry ? inferThinkingMode(entry) : "switchable");
    const supportedReasoningEfforts = override?.supportedReasoningEfforts ?? (entry ? inferReasoningEfforts(entry) : undefined);
    const defaultReasoningEffort = override?.defaultReasoningEffort ?? (entry ? inferDefaultReasoningEffort(entry) : "enabled");
    const apiMode = override?.apiMode ?? (entry ? deduceApiModeFromFamily(modelId, entry) : "openai");

    const cost = override?.cost ?? entry?.cost ?? { cache_read: 0, input: 0, output: 0 };
    return { displayName, contextLength, maxTokens, vision, thinkingMode, supportedReasoningEfforts, defaultReasoningEffort, apiMode, status, cost };
}

/**
 * Build enumeration values/items/descriptions for the reasoning effort selector.
 */
function buildReasoningEnum(thinkingMode: string, supportedReasoningEfforts: string[] | undefined) {
    const hasEfforts = supportedReasoningEfforts && supportedReasoningEfforts.length > 0;
    let enumValues: string[];
    if (hasEfforts) {
        if (thinkingMode === "switchable") {
            enumValues = ["disabled", ...supportedReasoningEfforts];
        } else if (thinkingMode === "adaptive") {
            enumValues = ["disabled", "adaptive"];
        } else {
            enumValues = [...supportedReasoningEfforts];
        }
    } else {
        if (thinkingMode === "switchable") {
            enumValues = ["disabled", "enabled"];
        } else if (thinkingMode === "adaptive") {
            enumValues = ["disabled", "adaptive"];
        } else {
            enumValues = ["enabled"];
        }
    }

    const labelMap: Record<string, string> = {
        disabled: l10n("Disabled"),
        adaptive: l10n("Adaptive"),
        enabled: l10n("Thinking"),
        high: l10n("High"),
        max: l10n("Maximum"),
    };
    const descMap: Record<string, string> = {
        disabled: l10n("Do not enable thinking"),
        adaptive: l10n("Automatically decide when to think"),
        enabled: l10n("Enable thinking"),
        high: l10n("Deeper thinking, slower response"),
        max: l10n("Maximum thinking depth, slowest response"),
    };

    const enumItemLabels = enumValues.map((e) => labelMap[e] ?? e);
    const enumDescriptions = enumValues.map((e) => descMap[e] ?? e);

    return { enumValues, enumItemLabels, enumDescriptions };
}

/**
 * Build LanguageModelChatInformation array from a list of model IDs.
 * Metadata is resolved from the catalog with override fallback.
 */
function buildModelInfos(modelIds: string[]): LanguageModelChatInformation[] {
    const infos: LanguageModelChatInformation[] = [];

    for (const modelId of modelIds) {
        const meta = resolveZenMetadata(modelId);
        const { enumValues, enumItemLabels, enumDescriptions } = buildReasoningEnum(meta.thinkingMode, meta.supportedReasoningEfforts);

        infos.push({
            id: modelId,
            name: meta.displayName,
            detail: "OpenCode Zen",
            tooltip: "OpenCode Zen",
            family: EXTENSION_LABEL_ZEN,
            version: "1.0.0",
            maxInputTokens: meta.contextLength,
            maxOutputTokens: meta.maxTokens,
            isUserSelectable: true,
            capabilities: {
                toolCalling: true,
                // Always declare imageInput=true so VS Code passes image data through.
                // Non-vision models handle images via the ask_image tool proxy internally.
                imageInput: true,
            },
            configurationSchema: {
                properties: {
                    reasoningEffort: {
                        type: "string",
                        title: l10n("Reasoning Effort"),
                        enum: enumValues,
                        enumItemLabels: enumItemLabels,
                        enumDescriptions: enumDescriptions,
                        default: meta.defaultReasoningEffort,
                        group: "navigation",
                    },
                },
            },
        } satisfies LanguageModelChatInformation);
    }

    return infos;
}

/**
 * Get the list of available Zen free models as LanguageModelChatInformation[].
 *
 * Flow:
 * 1. Try to fetch the model list from Zen API (with 5 min cache)
 * 2. Filter to only models with IDs ending in "-free"
 * 3. Load catalog metadata for enhanced model info
 * 4. If API is unreachable, use stale cache; if no cache, return empty
 *
 * @param secrets SecretStorage instance for reading the API key.
 */
export async function getZenFreeModelInfos(secrets: vscode.SecretStorage): Promise<LanguageModelChatInformation[]> {
    const now = Date.now();

    // Use cached result if still fresh
    if (cachedModelIds !== null && now - cacheTimestamp < CACHE_TTL_MS) {
        await ensureModelsDevLoaded();
        return buildModelInfos(cachedModelIds);
    }

    // Try fetching from Zen API
    const apiKey = await secrets.get("opencodego.apiKey");

    if (apiKey) {
        try {
            const allModelIds = await fetchZenModelList(apiKey);
            // Filter to free models (IDs ending with "-free")
            const availableFreeModels = allModelIds.filter((id) => id.endsWith("-free"));

            // Update cache
            cachedModelIds = availableFreeModels;
            cacheTimestamp = now;

            await ensureModelsDevLoaded();
            return buildModelInfos(availableFreeModels);
        } catch (error) {
            console.error("[OpenCodeGo] Failed to fetch Zen model list:", error);
            // Fall through to use stale cache
        }
    }

    // Use stale cache if available
    if (cachedModelIds !== null) {
        await ensureModelsDevLoaded();
        return buildModelInfos(cachedModelIds);
    }

    // No cache and API failed — return empty (Zen models require API reachability)
    return [];
}

/**
 * Get model configuration for a Zen free model.
 * Returns undefined if the model ID does not end with "-free".
 * Metadata resolved from: overrides > catalog provider entry > global catalog entry > defaults.
 */
export async function getZenFreeModelConfig(modelId: string): Promise<OpenCodeGoModelItem | undefined> {
    if (!modelId.endsWith("-free")) {
        return undefined;
    }

    await ensureModelsDevLoaded();
    const baseUrl = await resolveZenBaseUrl();
    const meta = resolveZenMetadata(modelId);

    const config: OpenCodeGoModelItem = {
        id: modelId,
        owned_by: "opencode",
        displayName: meta.displayName,
        baseUrl: baseUrl,
        vision: meta.vision,
        context_length: meta.contextLength,
        max_completion_tokens: meta.maxTokens,
        apiMode: meta.apiMode,
        enable_thinking: true,
        include_reasoning_in_request: true,
        thinkingMode: meta.thinkingMode,
    };

    if (meta.defaultReasoningEffort) {
        config.reasoning_effort = meta.defaultReasoningEffort;
    }

    return config;
}
