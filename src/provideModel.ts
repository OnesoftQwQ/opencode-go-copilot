import * as vscode from "vscode";
import { CancellationToken, LanguageModelChatInformation, LanguageModelChatCapabilities, PrepareLanguageModelChatModelOptions } from "vscode";

import { logger } from "./logger";
import { getBuiltInModelInfos } from "./models";
import { getZenFreeModelInfos } from "./zen/zenModels";
import { getApiModelIds } from "./apiModelList";
import { ensureModelsDevLoaded, lookupModelDevEntry, deduceApiModeFromFamily, type ModelsDevEntry } from "./modelsDev";
import type { OpenCodeGoModelItem } from "./types";
import { l10n } from "./localize";

const EXTENSION_LABEL = "OpenCodeGo";
const DEFAULT_CONTEXT_LENGTH = 128000;
const DEFAULT_MAX_TOKENS = 4096;

const _autoDiscoveredConfigs = new Map<string, OpenCodeGoModelItem>();

/**
 * Build a LanguageModelChatInformation entry for an auto-discovered model.
 * All auto-discovered models default to thinkingMode="always" (no thinking toggle).
 */
function buildAutoDiscoveredInfo(
    modelId: string,
    entry: ModelsDevEntry | undefined
): LanguageModelChatInformation | undefined {
    // Determine vision support
    const modalities = entry?.modalities?.input ?? [];
    const hasImage = modalities.includes("image") || modalities.includes("video");
    const vision = entry?.attachment === true || hasImage;

    // Determine display name
    const displayName = entry?.name ?? modelId;

    // Determine context length and max tokens
    const contextLength = entry?.limit?.context ?? DEFAULT_CONTEXT_LENGTH;
    const maxOutputTokens = entry?.limit?.output ?? DEFAULT_MAX_TOKENS;

    // Determine tool calling support
    const toolCalling = entry?.tool_call ?? true;

    // Determine thinking mode from models.dev reasoning field
    // reasoning=true → model supports thinking → show toggle (switchable)
    // reasoning=false/undefined → no thinking capability → always (no toggle)
    const hasReasoning = entry?.reasoning === true;
    let enumValues: string[];
    let enumItemLabels: string[];
    let enumDescriptions: string[];
    let defaultEffort: string;

    if (hasReasoning) {
        // switchable: user can turn thinking on/off
        enumValues = ["disabled", "enabled"];
        enumItemLabels = [l10n("Disabled"), l10n("Thinking")];
        enumDescriptions = [l10n("Do not enable thinking"), l10n("Enable thinking")];
        defaultEffort = "enabled";
    } else {
        // always: thinking not supported, no toggle
        enumValues = ["enabled"];
        enumItemLabels = [l10n("Thinking")];
        enumDescriptions = [l10n("Enable thinking")];
        defaultEffort = "enabled";
    }

    // Create the entry
    const info: LanguageModelChatInformation = {
        id: modelId,
        name: displayName,
        detail: "OpenCode Go",
        tooltip: "OpenCode Go",
        family: EXTENSION_LABEL,
        version: "1.0.0",
        maxInputTokens: contextLength,
        maxOutputTokens: maxOutputTokens,
        isUserSelectable: true,
        capabilities: {
            toolCalling: toolCalling,
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
                    default: "enabled",
                    group: "navigation",
                },
            },
        },
    } satisfies LanguageModelChatInformation;

    return info;
}

/**
 * Build and store an OpenCodeGoModelItem config for an auto-discovered model.
 */
function storeAutoDiscoveredConfig(modelId: string, entry: ModelsDevEntry | undefined): OpenCodeGoModelItem {
    const modalities = entry?.modalities?.input ?? [];
    const hasImage = modalities.includes("image") || modalities.includes("video");
    const vision = entry?.attachment === true || hasImage;
    const hasReasoning = entry?.reasoning === true;

    const config: OpenCodeGoModelItem = {
        id: modelId,
        owned_by: "opencode",
        displayName: entry?.name ?? modelId,
        vision: vision,
        supportsTemperature: entry?.temperature ?? true,
        context_length: entry?.limit?.context ?? DEFAULT_CONTEXT_LENGTH,
        max_completion_tokens: entry?.limit?.output ?? DEFAULT_MAX_TOKENS,
        apiMode: deduceApiModeFromFamily(modelId, entry),
        enable_thinking: hasReasoning,
        include_reasoning_in_request: hasReasoning,
        thinkingMode: hasReasoning ? "switchable" : "always",
    };

    // Keep the entry reference for reference
    _autoDiscoveredConfigs.set(modelId, config);
    return config;
}

/**
 * Get model configuration for a previously auto-discovered model.
 * Returns undefined if the model ID was not auto-discovered.
 */
export function getAutoDiscoveredModelConfig(modelId: string): OpenCodeGoModelItem | undefined {
    const config = _autoDiscoveredConfigs.get(modelId);
    return config ? { ...config } : undefined;
}

/**
 * Clear all auto-discovered model configs (for testing / manual refresh).
 */
export function clearAutoDiscoveredConfigs(): void {
    _autoDiscoveredConfigs.clear();
}

/**
 * Get the list of available language models contributed by this provider.
 *
 * When the "opencodego.enableAutoModelDiscovery" setting is enabled (default),
 * the provider fetches the actual model list from the API and:
 * - Filters built-in models to only those present in the API list
 *   (models not available on the server are hidden)
 * - Discovers new models from the API that are not in the built-in list,
 *   using models.dev metadata to populate their capabilities
 *   (auto-discovered models default to thinkingMode="always")
 *
 * Falls back to the full built-in list if the API is unreachable.
 *
 * When "opencodego.enableZenFreeModels" is also enabled, OpenCode Zen
 * free models are appended after the discoverable models.
 */
export async function prepareLanguageModelChatInformation(
    options: PrepareLanguageModelChatModelOptions,
    _token: CancellationToken,
    _secrets: vscode.SecretStorage
): Promise<LanguageModelChatInformation[]> {
    const config = vscode.workspace.getConfiguration();
    let infos = getBuiltInModelInfos();

    // ── Auto Model Discovery ──
    const enableAutoDiscovery = config.get<boolean>("opencodego.enableAutoModelDiscovery", true);
    if (enableAutoDiscovery) {
        const apiKey = await _secrets.get("opencodego.apiKey");
        const apiModelIds = await getApiModelIds(apiKey);

        if (apiModelIds.size > 0) {
            const beforeCount = infos.length;

            // Step 1: Filter built-in models — keep only those present in the API list
            infos = infos.filter((info) => apiModelIds.has(info.id));
            const removedCount = beforeCount - infos.length;
            if (removedCount > 0) {
                logger.info("models.discovery", {
                    action: "filtered",
                    removed: removedCount,
                    remaining: infos.length,
                });
            }

            // Step 2: Discover new models — in API but not in built-in list
            const builtInIds = new Set(infos.map((i) => i.id));
            const newModelIds = [...apiModelIds].filter((id) => !builtInIds.has(id));

            if (newModelIds.length > 0) {
                // Prune stale auto-discovered entries before rebuilding
                _autoDiscoveredConfigs.clear();

                // Load models.dev metadata
                await ensureModelsDevLoaded();

                let addedCount = 0;
                for (const modelId of newModelIds) {
                    const entry = lookupModelDevEntry(modelId);
                    const newInfo = buildAutoDiscoveredInfo(modelId, entry);
                    if (newInfo) {
                        infos.push(newInfo);
                        // Store config for later lookup by provider.ts
                        storeAutoDiscoveredConfig(modelId, entry);
                        addedCount++;
                    }
                }

                if (addedCount > 0) {
                    logger.info("models.discovery", {
                        action: "added",
                        count: addedCount,
                        total: infos.length,
                    });
                }
            }
        } else {
            // API fetch failed or returned no models — use full built-in list as fallback
            logger.info("models.discovery", {
                action: "fallback",
                reason: apiModelIds.size === 0 ? "api_empty_or_failed" : "not_successful",
                count: infos.length,
            });
        }
    }

    // ── Zen Free Models (append) ──
    const enableZen = config.get<boolean>("opencodego.enableZenFreeModels", false);
    if (enableZen) {
        try {
            const zenInfos = await getZenFreeModelInfos(_secrets);
            if (zenInfos.length > 0) {
                infos.push(...zenInfos);
                logger.info("models.loaded", { count: zenInfos.length, source: "zen" });
            }
        } catch (error) {
            logger.error("models.loaded", {
                source: "zen",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    logger.info("models.loaded", { count: infos.length, source: "total" });
    return infos;
}
