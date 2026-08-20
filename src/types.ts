/** Request protocol used by an OpenCode model. */
export type ApiMode = "openai" | "openai-responses" | "anthropic";

/**
 * A single model entry for OpenCode Go.
 */
export interface OpenCodeGoModelItem {
    id: string;
    object?: string;
    created?: number;
    owned_by: string;
    configId?: string;
    displayName?: string;
    baseUrl?: string;
    context_length?: number;
    vision?: boolean;
    max_tokens?: number;
    // OpenAI new standard parameter
    max_completion_tokens?: number;
    reasoning_effort?: string;
    enable_thinking?: boolean;
    thinking_budget?: number;
    // Allow null so user can explicitly disable sending this parameter
    temperature?: number | null;
    top_p?: number | null;
    top_k?: number;
    min_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    repetition_penalty?: number;
    reasoning?: {
        effort?: string;
        exclude?: boolean;
        max_tokens?: number;
        enabled?: boolean;
    };
    extra?: Record<string, unknown>;
    /**
     * Optional family specification for the model.
     */
    family?: string;
    /**
     * Whether to include reasoning_content in assistant messages sent to the API.
     */
    include_reasoning_in_request?: boolean;
    /**
     * Whether this model can be used for Git commit message generation.
     */
    useForCommitGeneration?: boolean;
    /**
     * Model-specific delay in milliseconds between consecutive requests.
     */
    delay?: number;
    /** API mode (for internal use) */
    apiMode?: ApiMode;
    /** Whether this model supports switching thinking on/off ("switchable"), always has it ("always"), or only disabled/adaptive ("adaptive") */
    thinkingMode?: "switchable" | "always" | "adaptive";
    /** Whether this model supports setting temperature/top_p. Default true. */
    supportsTemperature?: boolean;
    /** Whether the catalog declares reasoning support. */
    supportsReasoning?: boolean;
    /** Whether the catalog declares an explicit off value for reasoning effort (`none`/`disabled`). Used by the OpenAI Responses adapter to avoid sending `reasoning.effort: "none"` to models that reject it. */
    supportsDisablingReasoning?: boolean;
    /** Custom HTTP headers */
    headers?: Record<string, string>;
    /** Cost information for this model */
    cost?: {
        cache_read: number;
        input: number;
        output: number;
    };
    /** Additional fields may be present in provider-specific entries */
    [key: string]: unknown;

}

/**
 * Response from the models endpoint.
 */
export interface ModelsResponse {
    object: string;
    data: ModelItem[];
}

export interface ModelItem {
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
}

/**
 * A model preset for temperature and top_p configuration.
 */
export interface ModelPreset {
    id: string;
    label: string;
    temperature: number;
    top_p: number;
}

/**
 * Retry configuration.
 */
export interface RetryConfig {
    enabled: boolean;
    maxAttempts: number;
    intervalMs: number;
    backoffFactor: number;
    maxIntervalMs: number;
    statusCodes: number[];
}
