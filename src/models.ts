import type { LanguageModelChatInformation } from "vscode";
import type { OpenCodeGoModelItem } from "./types";

/**
 * Built-in model definition for OpenCode Go.
 */
interface BuiltInModelDef {
    /** Base model ID sent to the API (e.g., "glm-5.1") */
    baseId: string;
    /** User-friendly display name (e.g., "GLM-5.1") */
    displayName: string;
    /** Whether the model supports image input */
    vision: boolean;
    /** Thinking mode: "switchable" = two variants registered, "always" = thinking forced on */
    thinkingMode: "switchable" | "always";
    /** Default reasoning effort when thinking is enabled */
    defaultReasoningEffort?: string;
    /** Whether to include reasoning_content in assistant messages */
    includeReasoningInRequest?: boolean;
    /** Default context length */
    contextLength?: number;
    /** Default max output tokens */
    maxTokens?: number;
    /** Extra body parameters to include in API requests */
    extra?: Record<string, unknown>;
}

const EXTENSION_LABEL = "OpenCodeGo";
const DEFAULT_CONTEXT_LENGTH = 128000;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Built-in model definitions.
 */
const BUILT_IN_MODELS: BuiltInModelDef[] = [
    // ── GLM series ── Zhipu GLM 官方文档: 200K context, 128K max output ──
    { baseId: "glm-5.1", displayName: "GLM-5.1", vision: false, thinkingMode: "switchable", contextLength: 200000, maxTokens: 131072 },
    { baseId: "glm-5", displayName: "GLM-5", vision: false, thinkingMode: "switchable", contextLength: 200000, maxTokens: 131072 },

    // ── Kimi series ── Moonshot AI, 官方文档: 256K context (262144 tokens) ──
    { baseId: "kimi-k2.5", displayName: "Kimi K2.5", vision: true, thinkingMode: "switchable", contextLength: 262144, maxTokens: 16384 },
    { baseId: "kimi-k2.6", displayName: "Kimi K2.6", vision: true, thinkingMode: "switchable", contextLength: 262144, maxTokens: 16384 },

    // ── DeepSeek series ── 官方文档: 1M context, 384K max output ──
    { baseId: "deepseek-v4-pro", displayName: "DeepSeek V4 Pro", vision: false, thinkingMode: "switchable", defaultReasoningEffort: "max", contextLength: 1000000, maxTokens: 393216 },
    { baseId: "deepseek-v4-flash", displayName: "DeepSeek V4 Flash", vision: false, thinkingMode: "switchable", defaultReasoningEffort: "max", contextLength: 1000000, maxTokens: 393216 },

    // ── MiMo series ── 小米 MiMo 官方模型卡: 256K context (262144) ──
    { baseId: "mimo-v2-pro", displayName: "MiMo-V2-Pro", vision: false, thinkingMode: "always", contextLength: 262144, maxTokens: 32768 },
    { baseId: "mimo-v2-omni", displayName: "MiMo-V2-Omni", vision: true, thinkingMode: "always", contextLength: 262144, maxTokens: 32768 },
    { baseId: "mimo-v2.5-pro", displayName: "MiMo-V2.5-Pro", vision: false, thinkingMode: "always", contextLength: 262144, maxTokens: 32768 },
    { baseId: "mimo-v2.5", displayName: "MiMo-V2.5", vision: false, thinkingMode: "always", contextLength: 262144, maxTokens: 32768 },

    // ── MiniMax series ── 官方文档: 204800 context (204.8K) ──
    { baseId: "minimax-m2.7", displayName: "MiniMax M2.7", vision: false, thinkingMode: "always", extra: { reasoning_split: true }, contextLength: 204800, maxTokens: 32768 },
    { baseId: "minimax-m2.5", displayName: "MiniMax M2.5", vision: false, thinkingMode: "always", contextLength: 204800, maxTokens: 32768 },

    // ── Qwen series ── 阿里云百炼: Qwen3.6-Plus 1M context, Qwen3.5-Plus 同代同规格 ──
    { baseId: "qwen3.6-plus", displayName: "Qwen3.6 Plus", vision: true, thinkingMode: "switchable", contextLength: 1000000, maxTokens: 32768 },
    { baseId: "qwen3.5-plus", displayName: "Qwen3.5 Plus", vision: true, thinkingMode: "switchable", contextLength: 1000000, maxTokens: 32768 },
];

/**
 * Get the built-in model list as LanguageModelChatInformation[].
 * For "switchable" thinking models, registers two entries:
 *   - "Instruct" suffix (thinking disabled)
 *   - "Thinking" suffix (thinking enabled)
 * For "always" thinking models, registers one entry.
 */
export function getBuiltInModelInfos(): LanguageModelChatInformation[] {
    const infos: LanguageModelChatInformation[] = [];

    for (const def of BUILT_IN_MODELS) {
        const contextLen = def.contextLength ?? DEFAULT_CONTEXT_LENGTH;
        const maxOutput = def.maxTokens ?? DEFAULT_MAX_TOKENS;
        const maxInput = contextLen;

        if (def.thinkingMode === "switchable") {
            // Register TWO variants: Instruct (no thinking) and Thinking (thinking enabled)

            // Instruct variant
            infos.push({
                id: `${def.baseId}::Instruct`,
                name: `${def.displayName} Instruct`,
                detail: `OpenCode Go`,
                tooltip: `OpenCode Go`,
                family: EXTENSION_LABEL,
                version: "1.0.0",
                maxInputTokens: maxInput,
                maxOutputTokens: maxOutput,
                capabilities: {
                    toolCalling: true,
                    imageInput: def.vision,
                },
            } satisfies LanguageModelChatInformation);

            // Thinking variant
            infos.push({
                id: `${def.baseId}::Thinking`,
                name: `${def.displayName} Thinking`,
                detail: `OpenCode Go`,
                tooltip: `OpenCode Go`,
                family: EXTENSION_LABEL,
                version: "1.0.0",
                maxInputTokens: maxInput,
                maxOutputTokens: maxOutput,
                capabilities: {
                    toolCalling: true,
                    imageInput: def.vision,
                },
            } satisfies LanguageModelChatInformation);
        } else {
            // "always" thinking: single entry
            infos.push({
                id: def.baseId,
                name: def.displayName,
                detail: `OpenCode Go`,
                tooltip: `OpenCode Go`,
                family: EXTENSION_LABEL,
                version: "1.0.0",
                maxInputTokens: maxInput,
                maxOutputTokens: maxOutput,
                capabilities: {
                    toolCalling: true,
                    imageInput: def.vision,
                },
            } satisfies LanguageModelChatInformation);
        }
    }

    return infos;
}

/**
 * Get the total count of built-in model entries (after expanding switchable models).
 */
export function getBuiltInModelCount(): number {
    let count = 0;
    for (const def of BUILT_IN_MODELS) {
        count += def.thinkingMode === "switchable" ? 2 : 1;
    }
    return count;
}

/**
 * Find a built-in model definition by a parsed model ID (baseId::configId).
 * Returns the model properties that should be applied to the request.
 * Falls back to finding by baseId alone.
 */
export function getBuiltInModelConfig(modelId: string): OpenCodeGoModelItem | undefined {
    const parts = modelId.split("::");
    const baseId = parts[0];
    const configId = parts[1];

    const def = BUILT_IN_MODELS.find((m) => m.baseId === baseId);
    if (!def) {
        return undefined;
    }

    const model: OpenCodeGoModelItem = {
        id: def.baseId,
        owned_by: "opencode",
        displayName: def.displayName,
        vision: def.vision,
        context_length: def.contextLength ?? DEFAULT_CONTEXT_LENGTH,
        max_completion_tokens: def.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    // Pass through extra body parameters
    if (def.extra) {
        model.extra = { ...def.extra };
    }

    // Apply thinking-related settings based on variant
    if (def.thinkingMode === "switchable") {
        if (configId === "Thinking") {
            model.enable_thinking = true;
            if (def.defaultReasoningEffort) {
                model.reasoning_effort = def.defaultReasoningEffort;
            }
            model.include_reasoning_in_request = true;
            model.configId = "Thinking";
        } else {
            // Instruct variant: no thinking
            model.enable_thinking = false;
            model.configId = "Instruct";
        }
    } else {
        // "always" thinking: thinking forced on
        model.enable_thinking = true;
        model.include_reasoning_in_request = true;
    }

    return model;
}
