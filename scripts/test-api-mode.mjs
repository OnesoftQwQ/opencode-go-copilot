import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

const vscodeShim = {
    workspace: {
        getConfiguration: () => ({ get: (_key, fallback) => fallback }),
    },
    window: {
        createOutputChannel: () => ({
            debug() {},
            info() {},
            warn() {},
            error() {},
            dispose() {},
        }),
    },
};

Module._load = function (request, parent, isMain) {
    if (request === "vscode") {
        return vscodeShim;
    }
    return originalLoad.call(this, request, parent, isMain);
};

try {
    const { deduceApiModeFromCatalog, inferThinkingMode, inferSupportsDisablingReasoning } = require("../out/modelsDev.js");

    assert.equal(deduceApiModeFromCatalog("gpt-5.6-luna", "@ai-sdk/openai"), "openai-responses");
    assert.equal(deduceApiModeFromCatalog("glm-5", "@ai-sdk/openai-compatible"), "openai");
    assert.equal(deduceApiModeFromCatalog("minimax-m3", "@ai-sdk/anthropic"), "anthropic");

    // Legacy catalog fallback remains compatible with the existing family rules.
    assert.equal(deduceApiModeFromCatalog("qwen3.7-plus", undefined, { family: "qwen" }), "anthropic");
    assert.equal(deduceApiModeFromCatalog("unknown-model", undefined, { family: "unknown" }), "openai");

    // A provider-wide adapter is passed only after the caller has checked the
    // model-level override, so the selected adapter remains deterministic.
    assert.equal(deduceApiModeFromCatalog("grok-4.5", "@ai-sdk/openai"), "openai-responses");

    // Thinking mode keeps the pre-existing semantics: any reasoning_options
    // makes the model "switchable" — disabling on Chat/Anthropic protocols is
    // done via `thinking` flags, not via an effort value.
    assert.equal(inferThinkingMode({
        id: "gpt-5.6-luna",
        reasoning: true,
        reasoning_options: [{ type: "effort", values: ["none", "low", "high"] }],
    }), "switchable");
    assert.equal(inferThinkingMode({
        id: "grok-4.5",
        reasoning: true,
        reasoning_options: [{ type: "effort", values: ["low", "medium", "high"] }],
    }), "switchable");
    assert.equal(inferThinkingMode({
        id: "plain-no-reasoning",
        reasoning: false,
        reasoning_options: [],
    }), "always");

    // Whether a model accepts an explicit off effort value (used only by the
    // Responses adapter to decide if `reasoning.effort: "none"` may be sent).
    assert.equal(inferSupportsDisablingReasoning({
        id: "gpt-5.6-luna",
        reasoning: true,
        reasoning_options: [{ type: "effort", values: ["none", "low", "high"] }],
    }), true);
    assert.equal(inferSupportsDisablingReasoning({
        id: "grok-4.5",
        reasoning: true,
        reasoning_options: [{ type: "effort", values: ["low", "medium", "high"] }],
    }), false);
    assert.equal(inferSupportsDisablingReasoning({
        id: "qwen-toggle",
        reasoning: true,
        reasoning_options: [{ type: "toggle" }],
    }), true);
    assert.equal(inferSupportsDisablingReasoning({
        id: "always-thinking",
        reasoning: true,
        reasoning_options: [],
    }), false);

    console.log("api mode resolution: ok");
} finally {
    Module._load = originalLoad;
}
