import * as vscode from "vscode";
import type { LanguageModelChatInformation } from "vscode";
import type { OpenCodeGoModelItem } from "../types";
import { l10n } from "../localize";
import { ensureModelsDevLoaded, lookupModelDevEntry, deduceApiModeFromFamily, type ModelsDevEntry } from "../modelsDev";

/**
 * Minimal overrides for Zen free models that need non-default values.
 *
 * Defaults (used when no override and no models.dev data):
 *   thinkingMode: "switchable"
 *   apiMode: "openai"
 *   contextLength: 128000
 *   maxTokens: 4096
 *   vision: false
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
}>> = {
    "deepseek-v4-flash-free": {
        thinkingMode: "switchable",
        supportedReasoningEfforts: ["high", "max"],
        defaultReasoningEffort: "max",
        maxTokens: 32768,
        contextLength: 1000000,
    },
    "minimax-m3-free": {
        thinkingMode: "adaptive",
        defaultReasoningEffort: "adaptive",
        apiMode: "anthropic",
        maxTokens: 32768,
        contextLength: 1000000,
        vision: true,
    },
};

const EXTENSION_LABEL_ZEN = "OpenCode Zen";
const ZEN_BASE_URL = "https://opencode.ai/zen/v1/";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Module-level cache for Zen model list ──
let cachedModelIds: string[] | null = null;
let cacheTimestamp = 0;

/**
 * Fetch the full model list from OpenCode Zen API.
 * The endpoint follows OpenAI /v1/models format:
 *   { object: "list", data: [{ id: string, object: string, created: number, owned_by: string }, ...] }
 */
async function fetchZenModelList(apiKey: string): Promise<string[]> {
    const url = `${ZEN_BASE_URL.replace(/\/+$/, "")}/models`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Zen API error: [${response.status}] ${response.statusText}`);
    }

    const body = (await response.json()) as { data?: Array<{ id: string }> };
    return (body.data ?? []).map((m) => m.id);
}

/**
 * Build LanguageModelChatInformation array from a list of model IDs.
 * For each model, merge metadata from: ZEN_MODEL_OVERRIDES > models.dev > conservative defaults.
 * - switchable models: include "disabled" option so user can turn off thinking
 * - always models: no "disabled" option, thinking always on
 */
function buildModelInfos(modelIds: string[]): LanguageModelChatInformation[] {
    const infos: LanguageModelChatInformation[] = [];

    for (const modelId of modelIds) {
        // Merge: overrides > models.dev > defaults
        const override = ZEN_MODEL_OVERRIDES[modelId];
        const entry = lookupModelDevEntry(modelId);

        const displayName = override?.displayName ?? entry?.name ?? modelId;
        const contextLength = override?.contextLength ?? entry?.limit?.context ?? 128000;
        const maxTokens = override?.maxTokens ?? entry?.limit?.output ?? 4096;
        const vision = override?.vision ?? (entry?.attachment === true || (entry?.modalities?.input?.includes("image") ?? false)) ?? false;
        const thinkingMode = override?.thinkingMode ?? "switchable";
        const supportedReasoningEfforts = override?.supportedReasoningEfforts;
        const defaultReasoningEffort = override?.defaultReasoningEffort ?? "enabled";

        // Build reasoning effort enum based on thinking mode
        // - "switchable" + hasEfforts: disabled / [effort levels]
        // - "switchable" + no efforts: disabled / enabled
        // - "adaptive"               : disabled / adaptive
        // - "always"    + hasEfforts: [effort levels]
        // - "always"    + no efforts: enabled
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
        const enumItemLabels = enumValues.map((e) => {
            switch (e) {
                case 'disabled': return l10n("Disabled");
                case 'adaptive': return l10n("Adaptive");
                case 'enabled': return l10n("Thinking");
                case 'high': return l10n("High");
                case 'max': return l10n("Maximum");
                default: return e;
            }
        });
        const enumDescriptions = enumValues.map((e) => {
            switch (e) {
                case 'disabled': return l10n("Do not enable thinking");
                case 'adaptive': return l10n("Automatically decide when to think");
                case 'enabled': return l10n("Enable thinking");
                case 'high': return l10n("Deeper thinking, slower response");
                case 'max': return l10n("Maximum thinking depth, slowest response");
                default: return e;
            }
        });

        infos.push({
            id: modelId,
            name: displayName,
            detail: "OpenCode Zen",
            tooltip: "OpenCode Zen",
            family: EXTENSION_LABEL_ZEN,
            version: "1.0.0",
            maxInputTokens: contextLength,
            maxOutputTokens: maxTokens,
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
                        default: defaultReasoningEffort,
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
 * 3. Load models.dev metadata for enhanced model info
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
 * Merges metadata from: ZEN_MODEL_OVERRIDES > models.dev > conservative defaults.
 */
export async function getZenFreeModelConfig(modelId: string): Promise<OpenCodeGoModelItem | undefined> {
    if (!modelId.endsWith("-free")) {
        return undefined;
    }

    // Ensure models.dev metadata is loaded for correct apiMode/context/token info
    await ensureModelsDevLoaded();

    // Merge: overrides > models.dev > defaults
    const override = ZEN_MODEL_OVERRIDES[modelId];
    const entry = lookupModelDevEntry(modelId);

    const displayName = override?.displayName ?? entry?.name ?? modelId;
    const contextLength = override?.contextLength ?? entry?.limit?.context ?? 128000;
    const maxTokens = override?.maxTokens ?? entry?.limit?.output ?? 4096;
    const vision = override?.vision ?? (entry?.attachment === true || (entry?.modalities?.input?.includes("image") ?? false)) ?? false;
    const thinkingMode = override?.thinkingMode ?? "switchable";
    const apiMode = override?.apiMode ?? deduceApiModeFromFamily(modelId, entry);

    return {
        id: modelId,
        owned_by: "opencode",
        displayName: displayName,
        baseUrl: ZEN_BASE_URL,
        vision: vision,
        context_length: contextLength,
        max_completion_tokens: maxTokens,
        apiMode: apiMode,
        enable_thinking: true,
        include_reasoning_in_request: true,
        thinkingMode: thinkingMode,
    };
}
