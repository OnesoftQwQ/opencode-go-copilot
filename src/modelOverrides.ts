/**
 * Per-model override table.
 *
 * The models.dev catalog is the single source of truth for model metadata.
 * These overrides only carry fields the catalog cannot express (or gets wrong):
 * - apiMode (Anthropic vs OpenAI format) — the catalog only hints via npm field
 * - thinkingMode="adaptive" semantics
 * - extra request-body parameters (e.g. `reasoning_split`)
 * - default reasoning effort tuning (e.g. GLM-5.2 defaults to "high", not "max")
 *
 * Merge semantics: for each field, the override value wins when present;
 * otherwise the value resolved from the catalog is used.
 */

import type { ApiMode } from "./types";

/**
 * Override for a single model. Every field is optional — only the fields
 * written here take effect; everything else falls through to the catalog.
 */
export interface ModelMetaOverride {
    displayName?: string;
    vision?: boolean;
    thinkingMode?: "switchable" | "always" | "adaptive";
    supportedReasoningEfforts?: string[];
    defaultReasoningEffort?: string;
    contextLength?: number;
    maxOutputTokens?: number;
    apiMode?: ApiMode;
    supportsTemperature?: boolean;
    toolCalling?: boolean;
    /** Override whether the model accepts an explicit off effort value (`none`/`disabled`) on the Responses protocol. */
    supportsDisablingReasoning?: boolean;
    baseUrl?: string;
    /** Fields the catalog cannot express: request-body extras (e.g. reasoning_split) */
    extra?: Record<string, unknown>;
    /** Thinking budget in tokens (from catalog `budget_tokens`, may need manual tuning) */
    thinkingBudget?: { min?: number; max?: number };
    /** Whether to include reasoning_content in assistant messages sent to the API */
    includeReasoningInRequest?: boolean;
    status?: string;
    cost?: { cache_read: number; input: number; output: number };
}

/**
 * Per-model overrides, keyed by model ID.
 *
 * Note: Zen free models share the same namespace (IDs end with "-free") and
 * can be overridden here too — e.g. "minimax-m3-free" if it ever diverges
 * from its Go counterpart.
 */
export const MODEL_OVERRIDES: Record<string, ModelMetaOverride> = {
    // ── MiniMax series ── served via Anthropic-compatible API; M3 is adaptive-only
    "minimax-m3": {
        thinkingMode: "adaptive",
        apiMode: "anthropic",
        extra: { reasoning_split: true },
    },
    "minimax-m2.7": {
        apiMode: "anthropic",
        extra: { reasoning_split: true },
    },
    "minimax-m2.5": {
        apiMode: "anthropic",
    },

    // ── Qwen series ── served via Anthropic-compatible API
    "qwen3.7-max": { apiMode: "anthropic" },
    "qwen3.7-plus": { apiMode: "anthropic" },
    "qwen3.6-plus": { apiMode: "anthropic" },
    "qwen3.5-plus": { apiMode: "anthropic" },

    // ── GLM ── keep default effort at "high" (matches historical built-in config)
    "glm-5.2": { defaultReasoningEffort: "high" },
};
