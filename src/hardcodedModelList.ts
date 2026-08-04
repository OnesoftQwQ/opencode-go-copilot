/**
 * Hardcoded fallback model lists.
 *
 * Last-resort fallback when both the official models.dev catalog and the
 * configured mirror are unreachable. Only model IDs (plus display names) are
 * baked in; all metadata falls back to MODEL_OVERRIDES and the conservative
 * defaults in catalogModels.ts, and provider base URLs fall back to the
 * built-in defaults.
 *
 * Snapshot taken from the official models.dev catalog on 2026-08-04.
 */

export interface HardcodedModelEntry {
    id: string;
    name?: string;
}

export const HARDCODED_MODEL_LISTS: Record<string, HardcodedModelEntry[]> = {
    "opencode-go": [
        { id: "qwen3.7-plus", name: "Qwen3.7 Plus" },
        { id: "glm-5", name: "GLM-5" },
        { id: "qwen3.5-plus", name: "Qwen3.5 Plus" },
        { id: "glm-5.1", name: "GLM-5.1" },
        { id: "mimo-v2-omni", name: "MiMo V2 Omni" },
        { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash (New)" },
        { id: "kimi-k2.5", name: "Kimi K2.5" },
        { id: "minimax-m2.7", name: "MiniMax-M2.7" },
        { id: "glm-5.2", name: "GLM-5.2" },
        { id: "qwen3.7-max", name: "Qwen3.7 Max" },
        { id: "kimi-k2.6", name: "Kimi K2.6" },
        { id: "mimo-v2-pro", name: "MiMo V2 Pro" },
        { id: "minimax-m3", name: "MiniMax-M3" },
        { id: "hy3", name: "Hy3" },
        { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
        { id: "qwen3.8-max", name: "Qwen3.8 Max" },
        { id: "mimo-v2.5", name: "MiMo V2.5" },
        { id: "minimax-m2.5", name: "MiniMax-M2.5" },
        { id: "gpt-5.6-luna", name: "GPT-5.6 Luna (2x usage)" },
        { id: "grok-4.5", name: "Grok 4.5" },
        { id: "kimi-k2.7-code", name: "Kimi K2.7 Code" },
        { id: "kimi-k3", name: "Kimi K3" },
        { id: "mimo-v2.5-pro", name: "MiMo V2.5 Pro" },
        { id: "qwen3.6-plus", name: "Qwen3.6 Plus" },
    ],
    "opencode": [
        { id: "trinity-large-preview-free", name: "Trinity Large Preview" },
        { id: "hy3-preview-free", name: "Hy3 preview Free" },
        { id: "minimax-m3-free", name: "MiniMax-M3 Free" },
        { id: "glm-4.7-free", name: "GLM-4.7 Free" },
        { id: "north-mini-code-free", name: "North Mini Code Free" },
        { id: "qwen3.6-plus-free", name: "Qwen3.6 Plus Free" },
        { id: "ling-3.0-flash-free", name: "Ling-3.0-flash Free" },
        { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free" },
        { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free (New)" },
        { id: "glm-5-free", name: "GLM-5 Free" },
        { id: "mimo-v2-omni-free", name: "MiMo V2 Omni Free" },
        { id: "minimax-m2.5-free", name: "MiniMax-M2.5 Free" },
        { id: "minimax-m2.1-free", name: "MiniMax-M2.1 Free" },
        { id: "mimo-v2-flash-free", name: "MiMo V2 Flash Free" },
        { id: "hy3-free", name: "Hy3 Free" },
        { id: "kimi-k2.5-free", name: "Kimi K2.5 Free" },
        { id: "mimo-v2.5-free", name: "MiMo V2.5 Free" },
        { id: "nemotron-3-super-free", name: "Nemotron 3 Super Free" },
        { id: "nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free" },
        { id: "ring-2.6-1t-free", name: "Ring 2.6 1T Free" },
        { id: "mimo-v2-pro-free", name: "MiMo V2 Pro Free" },
        { id: "ling-2.6-flash-free", name: "Ling 2.6 Flash Free" },
    ],
};
