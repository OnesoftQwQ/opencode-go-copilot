import * as vscode from "vscode";
import { CancellationToken, LanguageModelChatInformation, PrepareLanguageModelChatModelOptions } from "vscode";

import { logger } from "./logger";
import { getBuiltInModelInfos } from "./models";
import { getZenFreeModelInfos } from "./zen/zenModels";
import { getApiModelIds } from "./apiModelList";
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
} from "./modelsDev";
import type { OpenCodeGoModelItem } from "./types";
import { l10n } from "./localize";
import { delay } from "./utils";

const EXTENSION_LABEL = "OpenCodeGo";
const DEFAULT_CONTEXT_LENGTH = 128000;
const DEFAULT_MAX_TOKENS = 4096;

const _autoDiscoveredConfigs = new Map<string, OpenCodeGoModelItem>();

let isUpdatingModelsDev = false;
let lastModelsDevUpdate = 0;
let cachedDiscoveredInfos: LanguageModelChatInformation[] | null = null;

let cachedZenInfos: LanguageModelChatInformation[] | null = null;
let lastZenUpdate = 0;

/**
 * Resolve metadata for an auto-discovered model.
 * Prefers provider-specific catalog entry, falls back to global entry.
 */
function resolveDiscoveredModelMeta(modelId: string) {
    const providerEntry = getCatalogProviderModelEntry("opencode-go", modelId);
    const globalEntry = lookupModelDevEntry(modelId);
    const entry = providerEntry ?? globalEntry;

    const displayName = entry?.name ?? modelId;
    const contextLength = entry?.limit?.context ?? DEFAULT_CONTEXT_LENGTH;
    const maxOutputTokens = entry?.limit?.output ?? DEFAULT_MAX_TOKENS;
    const toolCalling = entry?.tool_call ?? true;
    const thinkingMode = entry ? inferThinkingMode(entry) : "switchable";
    const supportedReasoningEfforts = entry ? inferReasoningEfforts(entry) : undefined;
    const defaultReasoningEffort = entry ? inferDefaultReasoningEffort(entry) : "enabled";
    const vision = entry ? inferVision(entry) : false;
    const cost = entry?.cost ?? { cache_read: 0, input: 0, output: 0 };
    return { displayName, contextLength, maxOutputTokens, toolCalling, thinkingMode, supportedReasoningEfforts, defaultReasoningEffort, vision, entry, cost };
}

/**
 * Build a LanguageModelChatInformation entry for an auto-discovered model.
 */
function buildAutoDiscoveredInfo(
    modelId: string,
    entry: ModelsDevEntry | undefined
): LanguageModelChatInformation {
    const meta = resolveDiscoveredModelMeta(modelId);

    const hasEfforts = meta.supportedReasoningEfforts && meta.supportedReasoningEfforts.length > 0;
    let enumValues: string[];
    if (meta.thinkingMode === "switchable") {
        if (hasEfforts) {
            enumValues = ["disabled", ...meta.supportedReasoningEfforts!];
        } else {
            enumValues = ["disabled", "enabled"];
        }
    } else {
        if (hasEfforts) {
            enumValues = [...meta.supportedReasoningEfforts!];
        } else {
            enumValues = ["enabled"];
        }
    }

    const getLabel = (e: string): string => {
        switch (e) {
            case 'disabled': return l10n("Disabled");
            case 'enabled': return l10n("Thinking");
            case 'high': return l10n("High");
            case 'max': return l10n("Maximum");
            default: return e.charAt(0).toUpperCase() + e.slice(1);
        }
    };
    const getDesc = (e: string): string => {
        switch (e) {
            case 'disabled': return l10n("Do not enable thinking");
            case 'enabled': return l10n("Enable thinking");
            case 'high': return l10n("Deeper thinking, slower response");
            case 'max': return l10n("Maximum thinking depth, slowest response");
            default: return e;
        }
    };

    const enumItemLabels = enumValues.map(getLabel);
    const enumDescriptions = enumValues.map(getDesc);

    return {
        id: modelId,
        name: meta.displayName,
        detail: "OpenCode Go",
        tooltip: "OpenCode Go",
        family: EXTENSION_LABEL,
        version: "1.0.0",
        maxInputTokens: meta.contextLength,
        maxOutputTokens: meta.maxOutputTokens,
        isUserSelectable: true,
        capabilities: {
            toolCalling: meta.toolCalling,
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
    } satisfies LanguageModelChatInformation;
}

/**
 * Build and store an OpenCodeGoModelItem config for an auto-discovered model.
 */
function storeAutoDiscoveredConfig(modelId: string, entry: ModelsDevEntry | undefined): OpenCodeGoModelItem {
    const meta = resolveDiscoveredModelMeta(modelId);

    const config: OpenCodeGoModelItem = {
        id: modelId,
        owned_by: "opencode",
        displayName: meta.displayName,
        baseUrl: getCatalogProviderBaseUrl("opencode-go", "https://opencode.ai/zen/go/v1/"),
        vision: meta.vision,
        supportsTemperature: meta.entry?.temperature ?? true,
        context_length: meta.contextLength,
        max_completion_tokens: meta.maxOutputTokens,
        apiMode: deduceApiModeFromFamily(modelId, meta.entry),
        enable_thinking: meta.thinkingMode !== "always",
        include_reasoning_in_request: meta.thinkingMode !== "always",
        thinkingMode: meta.thinkingMode,
        cost: meta.cost,
    };

    if (meta.defaultReasoningEffort) {
        config.reasoning_effort = meta.defaultReasoningEffort;
    }

    _autoDiscoveredConfigs.set(modelId, config);
    return config;
}

export function getAutoDiscoveredModelConfig(modelId: string): OpenCodeGoModelItem | undefined {
    const config = _autoDiscoveredConfigs.get(modelId);
    return config ? { ...config } : undefined;
}

export function clearAutoDiscoveredConfigs(): void {
    _autoDiscoveredConfigs.clear();
}

async function waitForPendingUpdate(token: CancellationToken): Promise<void> {
    while (isUpdatingModelsDev && !token.isCancellationRequested) {
        await delay(200, token);
    }
}

/**
 * Load models.dev metadata and map newly discovered API models.
 */
async function processNewModels(
    newModelIds: string[],
    currentInfos: LanguageModelChatInformation[],
    haveAPIKey: boolean,
): Promise<LanguageModelChatInformation[]> {
    if (newModelIds.length === 0) return currentInfos;

    await ensureModelsDevLoaded();

    const updatedInfos = [...currentInfos];
    const addedModels: string[] = [];

    for (const modelId of newModelIds) {
        const entry = lookupModelDevEntry(modelId);
        const newInfo = buildAutoDiscoveredInfo(modelId, entry);

        updatedInfos.push(newInfo);
        storeAutoDiscoveredConfig(modelId, entry);
        addedModels.push(modelId);
    }

    if (addedModels.length > 0) {
        logger.info("models.discovery", {
            action: "added",
            count: addedModels.length,
            // total: updatedInfos.length,
            source: "auto-discovered" + (haveAPIKey ? " (API)" : " (stale)"),
            infos: addedModels.join(", "),
        });
    }

    return updatedInfos;
}

/**
 * Fetch remote model IDs and perform filtering/discovery logic.
 */
async function runAutoDiscoveryPass(
    secrets: vscode.SecretStorage
): Promise<LanguageModelChatInformation[] | null> {
    const apiKey = await secrets.get("opencodego.apiKey");
    const apiModelIds = await getApiModelIds(apiKey);

    if (!apiModelIds || apiModelIds.size === 0) {
        logger.info("models.discovery", {
            action: "fallback",
            reason: "api_empty_or_failed",
        });
        return null;
    }

    // Print all fetched model IDs every time an actual API fetch takes place
    const fetchedIdsArray = Array.from(apiModelIds);
    logger.info("models.discovery", {
        action: "fetched_api_ids",
        count: fetchedIdsArray.length,
        ids: fetchedIdsArray.join(", "),
    });

    const builtIn = getBuiltInModelInfos();
    const filtered = builtIn.filter((info) => apiModelIds.has(info.id));
    const removedCount = builtIn.length - filtered.length;

    if (removedCount > 0) {
        logger.info("models.discovery", {
            action: "filtered",
            removed: removedCount,
            remaining: filtered.length,
        });
    }
    // TODO: Consider Pros and Cons of fetching all models.dev entries vs. only those that are new. 
    // fetching all -> latest cost and other meta
    // fetching only new -> More resilient to models.dev changes and possible network failures
    // To next stage maiintainer: as of 30/7/2026, fetch all reliabily fetches all cost info
    // will be useful if integrating cost tracking and filtering in the future.
    const existingIds = new Set(filtered.map((i) => i.id));
    // const existingIds = new Set(); // Use empty set to treat all fetched IDs as new for discovery
    const newModelIds = fetchedIdsArray.filter((id) => !existingIds.has(id));

    // Cleanup stored configs for models no longer returned by API
    for (const key of _autoDiscoveredConfigs.keys()) {
        if (!apiModelIds.has(key)) {
            _autoDiscoveredConfigs.delete(key);
        }
    }

    return processNewModels(newModelIds, filtered, !!apiKey);
}

export function resetAutoDiscoveryState(): void {
    isUpdatingModelsDev = false;
    lastModelsDevUpdate = 0;
    cachedDiscoveredInfos = null;
    cachedZenInfos = null;
    lastZenUpdate = 0;
    _autoDiscoveredConfigs.clear();
    logger.info("models.discovery", {
        action: "reset",
    });
}

/**
 * Fetch and append Zen free models with interval-based caching.
 */
async function fetchZenFreeModelsCached(
    secrets: vscode.SecretStorage,
    token: CancellationToken,
    updateInterval: number
): Promise<LanguageModelChatInformation[]> {
    const now = Date.now();
    if (cachedZenInfos && now - lastZenUpdate < updateInterval) {
        return cachedZenInfos;
    }

    if (token.isCancellationRequested) return cachedZenInfos ?? [];

    try {
        const zenInfos = await getZenFreeModelInfos(secrets);
        cachedZenInfos = zenInfos;
        lastZenUpdate = Date.now();
        if (zenInfos.length > 0) {
            logger.info("models.discovery", {
                action: "zen_free_models_loaded",
                count: zenInfos.length,
                ids: zenInfos.map((info) => info.id).join(", "),
                source: "zen-free",
            });
            logger.info("models.loaded", { count: zenInfos.length, source: "zen-free" });
        }

        return zenInfos;
    } catch (error) {
        logger.error("models.loaded", {
            source: "zen-free",
            error: error instanceof Error ? error.message : String(error),
        });
        return cachedZenInfos ?? [];
    }
}

export async function prepareLanguageModelChatInformation(
    options: PrepareLanguageModelChatModelOptions,
    _token: CancellationToken,
    _secrets: vscode.SecretStorage
): Promise<LanguageModelChatInformation[]> {
    if (_token.isCancellationRequested) {
        return cachedDiscoveredInfos ?? getBuiltInModelInfos();
    }

    const config = vscode.workspace.getConfiguration();
    const enableAutoDiscovery = config.get<boolean>("opencodego.enableAutoModelDiscovery", true);
    const updateInterval = config.get<number>("opencodego.modelsDevUpdateInterval", 60 * 60 * 1000);
    const now = Date.now();

    // ── Auto Model Discovery Pipeline ──
    if (enableAutoDiscovery) {
        if (isUpdatingModelsDev) {
            await waitForPendingUpdate(_token);
        } else if (now - lastModelsDevUpdate >= updateInterval) {
            isUpdatingModelsDev = true;
            try {
                if (!_token.isCancellationRequested) {
                    const discovered = await runAutoDiscoveryPass(_secrets);
                    if (discovered) {
                        cachedDiscoveredInfos = discovered;
                        lastModelsDevUpdate = Date.now();
                    }
                }
            } catch (error) {
                logger.error("models.discovery", {
                    action: "error",
                    error: error instanceof Error ? error.message : String(error),
                });
            } finally {
                isUpdatingModelsDev = false;
            }
        }
    }

    // ── Assemble Base & Secondary Model Lists ──
    const baseInfos = enableAutoDiscovery && cachedDiscoveredInfos
        ? [...cachedDiscoveredInfos]
        : getBuiltInModelInfos();

    const enableZen = config.get<boolean>("opencodego.enableZenFreeModels", false);
    const zenInfos = enableZen ? await fetchZenFreeModelsCached(_secrets, _token, updateInterval) : [];

    return [...baseInfos, ...zenInfos];
}