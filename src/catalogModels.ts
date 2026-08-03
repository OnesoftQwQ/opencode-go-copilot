/**
 * Unified model resolution layer.
 *
 * Every model — OpenCode Go and OpenCode Zen — flows through the same
 * two-layer merge chain:
 *
 *   1. resolveFromCatalog() — models.dev catalog
 *      (provider entry → global entry → conservative defaults, per field)
 *   2. applyOverride()      — MODEL_OVERRIDES[modelId] wins per field when present
 *
 * Zen and Go only differ in the provider ID and model filtering (-free suffix);
 * all resolution and build logic is shared.
 */

import type { LanguageModelChatInformation } from "vscode";
import type { OpenCodeGoModelItem } from "./types";
import { l10n } from "./localize";
import { MODEL_OVERRIDES, type ModelMetaOverride } from "./modelOverrides";
import {
    deduceApiModeFromFamily,
    getCatalogProviderBaseUrl,
    getCatalogProviderModelEntry,
    inferDefaultReasoningEffort,
    inferReasoningEfforts,
    inferThinkingBudget,
    inferThinkingMode,
    inferVision,
    lookupModelDevEntry,
    type ModelsDevEntry,
} from "./modelsDev";

/** Supported provider IDs. */
export type ProviderId = "opencode-go" | "opencode";

/** Fallback base URLs used when the catalog is not loaded. */
const FALLBACK_BASE_URLS: Record<ProviderId, string> = {
    "opencode-go": "https://opencode.ai/zen/go/v1/",
    "opencode": "https://opencode.ai/zen/v1/",
};

/** Per-provider display metadata (family grouping, name suffix). */
const PROVIDER_LABELS: Record<ProviderId, { family: string; detail: string; nameSuffix: string }> = {
    "opencode-go": { family: "OpenCodeGo", detail: "OpenCode Go", nameSuffix: "" },
    "opencode": { family: "OpenCode Zen", detail: "OpenCode Zen", nameSuffix: " Free" },
};

const DEFAULT_CONTEXT_LENGTH = 128000;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Resolved model metadata. Every field that the catalog can supply has a
 * conservative default, so the object is always complete.
 */
export interface ModelMeta {
    displayName: string;
    vision: boolean;
    thinkingMode: "switchable" | "always" | "adaptive";
    supportedReasoningEfforts: string[];
    defaultReasoningEffort: string;
    contextLength: number;
    maxOutputTokens: number;
    apiMode: "openai" | "anthropic";
    supportsTemperature: boolean;
    toolCalling: boolean;
    baseUrl: string;
    thinkingBudget?: { min?: number; max?: number };
    status?: string;
    cost: { cache_read: number; input: number; output: number };
}

/**
 * Resolve the provider for a model ID.
 * Zen free models follow the "-free" suffix convention; everything else is Go.
 */
export function resolveProviderForModelId(modelId: string): ProviderId {
    return modelId.endsWith("-free") ? "opencode" : "opencode-go";
}

/**
 * Resolve model metadata from the catalog with conservative defaults.
 * Per field: provider-specific entry → global entry → default.
 */
function resolveFromCatalog(providerId: ProviderId, modelId: string): ModelMeta {
    const providerEntry = getCatalogProviderModelEntry(providerId, modelId);
    const globalEntry = lookupModelDevEntry(modelId);
    const entry: ModelsDevEntry | undefined = providerEntry ?? globalEntry;

    const thinkingMode = entry ? inferThinkingMode(entry) : "switchable";
    const rawEfforts = entry ? inferReasoningEfforts(entry) : undefined;
    // Normalize: "none"/"disabled" effort values are represented by the "disabled" picker option
    const supportedReasoningEfforts = (rawEfforts ?? []).filter((e) => e !== "none" && e !== "disabled");

    return {
        displayName: entry?.name ?? modelId,
        vision: entry ? inferVision(entry) : false,
        thinkingMode,
        supportedReasoningEfforts,
        defaultReasoningEffort: entry ? inferDefaultReasoningEffort(entry) : "enabled",
        contextLength: entry?.limit?.context ?? DEFAULT_CONTEXT_LENGTH,
        maxOutputTokens: entry?.limit?.output ?? DEFAULT_MAX_TOKENS,
        apiMode: entry ? deduceApiModeFromFamily(modelId, entry) : "openai",
        supportsTemperature: entry?.temperature ?? true,
        toolCalling: entry?.tool_call ?? true,
        baseUrl: getCatalogProviderBaseUrl(providerId, FALLBACK_BASE_URLS[providerId]),
        thinkingBudget: entry ? inferThinkingBudget(entry) : undefined,
        status: entry?.status,
        cost: entry?.cost ?? { cache_read: 0, input: 0, output: 0 },
    };
}

/**
 * Apply per-model overrides. Override wins per field when present.
 */
function applyOverride(meta: ModelMeta, override?: ModelMetaOverride): ModelMeta {
    if (!override) return meta;
    return {
        displayName: override.displayName ?? meta.displayName,
        vision: override.vision ?? meta.vision,
        thinkingMode: override.thinkingMode ?? meta.thinkingMode,
        supportedReasoningEfforts: override.supportedReasoningEfforts ?? meta.supportedReasoningEfforts,
        defaultReasoningEffort: override.defaultReasoningEffort ?? meta.defaultReasoningEffort,
        contextLength: override.contextLength ?? meta.contextLength,
        maxOutputTokens: override.maxOutputTokens ?? meta.maxOutputTokens,
        apiMode: override.apiMode ?? meta.apiMode,
        supportsTemperature: override.supportsTemperature ?? meta.supportsTemperature,
        toolCalling: override.toolCalling ?? meta.toolCalling,
        baseUrl: override.baseUrl ?? meta.baseUrl,
        thinkingBudget: override.thinkingBudget ?? meta.thinkingBudget,
        status: override.status ?? meta.status,
        cost: override.cost ?? meta.cost,
    };
}

/**
 * Resolve the final metadata for a model through the merge chain.
 */
export function resolveModelMeta(providerId: ProviderId, modelId: string): ModelMeta {
    return applyOverride(resolveFromCatalog(providerId, modelId), MODEL_OVERRIDES[modelId]);
}

/**
 * Build the reasoning effort enum (values/labels/descriptions/default) for a model.
 */
function buildReasoningEnum(meta: ModelMeta): {
    enumValues: string[];
    enumItemLabels: string[];
    enumDescriptions: string[];
    defaultEffort: string;
} {
    const hasEfforts = meta.supportedReasoningEfforts.length > 0;
    let enumValues: string[];
    if (hasEfforts) {
        if (meta.thinkingMode === "switchable") {
            enumValues = ["disabled", ...meta.supportedReasoningEfforts];
        } else {
            enumValues = [...meta.supportedReasoningEfforts];
        }
    } else {
        if (meta.thinkingMode === "switchable") {
            enumValues = ["disabled", "enabled"];
        } else if (meta.thinkingMode === "adaptive") {
            enumValues = ["disabled", "adaptive"];
        } else {
            enumValues = ["enabled"];
        }
    }

    // Fall back to the last enum value when the requested default is not selectable
    // (e.g. "enabled" for an adaptive model).
    const defaultEffort = enumValues.includes(meta.defaultReasoningEffort)
        ? meta.defaultReasoningEffort
        : enumValues[enumValues.length - 1];

    const getLabel = (e: string): string => {
        switch (e) {
            case 'disabled': return l10n("Disabled");
            case 'adaptive': return l10n("Adaptive");
            case 'enabled': return l10n("Thinking");
            case 'low': return l10n("Low");
            case 'medium': return l10n("Medium");
            case 'high': return l10n("High");
            case 'xhigh': return l10n("Extra High");
            case 'max': return l10n("Maximum");
            default: return e.charAt(0).toUpperCase() + e.slice(1);
        }
    };
    const getDesc = (e: string): string => {
        switch (e) {
            case 'disabled': return l10n("Do not enable thinking");
            case 'adaptive': return l10n("Automatically decide when to think");
            case 'enabled': return l10n("Enable thinking");
            case 'low': return l10n("Reduce thinking, faster response");
            case 'medium': return l10n("Balance thinking and speed");
            case 'high': return l10n("Deeper thinking, slower response");
            case 'xhigh': return l10n("Very deep thinking, slower response");
            case 'max': return l10n("Maximum thinking depth, slowest response");
            default: return e;
        }
    };

    return {
        enumValues,
        enumItemLabels: enumValues.map(getLabel),
        enumDescriptions: enumValues.map(getDesc),
        defaultEffort,
    };
}

/**
 * Build a LanguageModelChatInformation entry (model picker) for a model.
 */
export function buildCatalogModelInfo(providerId: ProviderId, modelId: string): LanguageModelChatInformation {
    const meta = resolveModelMeta(providerId, modelId);
    const label = PROVIDER_LABELS[providerId];
    const isDeprecated = meta.status === "deprecated";
    // Zen free models: append " Free" only when the catalog name doesn't already carry it
    const nameSuffix = label.nameSuffix && !/\bfree\b/i.test(meta.displayName) ? label.nameSuffix : "";
    const name = `${isDeprecated ? `${l10n("[Depr] ")}` : ""}${meta.displayName}${nameSuffix}`;
    const { enumValues, enumItemLabels, enumDescriptions, defaultEffort } = buildReasoningEnum(meta);

    return {
        id: modelId,
        name,
        detail: label.detail,
        tooltip: label.detail,
        family: label.family,
        version: "1.0.0",
        maxInputTokens: meta.contextLength,
        maxOutputTokens: meta.maxOutputTokens,
        isUserSelectable: true,
        capabilities: {
            toolCalling: meta.toolCalling,
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
                    default: defaultEffort,
                    group: "navigation",
                },
            },
        },
    } satisfies LanguageModelChatInformation;
}

/**
 * Build the OpenCodeGoModelItem request config for a model.
 * The provider (Go vs Zen) is resolved from the model ID.
 */
export function getCatalogModelConfig(modelId: string): OpenCodeGoModelItem {
    const providerId = resolveProviderForModelId(modelId);
    const meta = resolveModelMeta(providerId, modelId);
    const override = MODEL_OVERRIDES[modelId];

    const config: OpenCodeGoModelItem = {
        id: modelId,
        owned_by: "opencode",
        displayName: meta.displayName,
        baseUrl: meta.baseUrl,
        vision: meta.vision,
        supportsTemperature: meta.supportsTemperature,
        context_length: meta.contextLength,
        max_completion_tokens: meta.maxOutputTokens,
        apiMode: meta.apiMode,
        enable_thinking: true,
        include_reasoning_in_request: override?.includeReasoningInRequest ?? true,
        thinkingMode: meta.thinkingMode,
        cost: meta.cost,
    };

    // Only send an explicit effort when it is a real effort value
    // ("enabled"/"adaptive" are handled via the thinking flags instead).
    if (meta.defaultReasoningEffort && meta.defaultReasoningEffort !== "enabled" && meta.defaultReasoningEffort !== "adaptive") {
        config.reasoning_effort = meta.defaultReasoningEffort;
    }
    if (meta.thinkingBudget?.max !== undefined) {
        config.thinking_budget = meta.thinkingBudget.max;
    }
    if (override?.extra) {
        config.extra = { ...override.extra };
    }

    return config;
}
