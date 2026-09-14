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
    /**
     * Whether the request body may include a top-level `thinking` field
     * (default true; false for routes whose schema rejects it, e.g.
     * glm-5.3/glm-5.3-flash on OpenCode Go, where thinking is mandatory and
     * only `reasoning_effort` is accepted).
     */
    supportsThinkingParam?: boolean;
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
    // GLM-5.3 / GLM-5.3-Flash always think and their upstream schema rejects
    // the Chat Completions `thinking` field entirely (400 'json: unknown field
    // "thinking"'), so the field is omitted and the thinking strength is
    // controlled only via `reasoning_effort` (low/high/max). thinkingMode
    // "always" hides the unsupported "禁用思考" option in the picker.
    "glm-5.3": { thinkingMode: "always", supportsThinkingParam: false },
    "glm-5.3-flash": { thinkingMode: "always", supportsThinkingParam: false },
};
