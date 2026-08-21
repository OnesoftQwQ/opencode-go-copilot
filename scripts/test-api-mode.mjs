import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
const originalFetch = globalThis.fetch;

const vscodeShim = {
    env: { language: "en" },
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
    const { logger } = require("../out/logger.js");
    logger.init();
    const {
        deduceApiModeFromCatalog,
        ensureModelsDevLoaded,
        inferDefaultReasoningEffort,
        inferThinkingMode,
        inferSupportsDisablingReasoning,
    } = require("../out/modelsDev.js");

    globalThis.fetch = async () => new Response(JSON.stringify({
        models: {},
        providers: {
            "opencode-go": {
                id: "opencode-go",
                npm: "@ai-sdk/openai-compatible",
                api: "https://example.test/zen/go/v1",
                models: {
                    hy3: {
                        id: "hy3",
                        name: "Hy3",
                        reasoning: true,
                        reasoning_options: [{ type: "effort", values: ["none", "low", "high"] }],
                        tool_call: true,
                        temperature: true,
                        limit: { context: 256000, output: 64000 },
                    },
                    "muse-spark-1.2-contributor": {
                        id: "muse-spark-1.2-contributor",
                        name: "Muse Spark 1.2 Contributor",
                        reasoning: true,
                        reasoning_options: [{ type: "effort", values: ["minimal", "low", "medium", "high", "xhigh"] }],
                        tool_call: true,
                        temperature: true,
                        limit: { context: 1048576, output: 131072 },
                        provider: { npm: "@ai-sdk/openai" },
                    },
                    "glm-5.2": {
                        id: "glm-5.2",
                        name: "GLM-5.2",
                        reasoning: true,
                        reasoning_options: [{ type: "effort", values: ["high", "max"] }],
                        tool_call: true,
                        temperature: true,
                        limit: { context: 202752, output: 131072 },
                    },
                },
            },
        },
    }), { status: 200 });
    await ensureModelsDevLoaded();

    const {
        applyReasoningEffortSelection,
        buildCatalogModelInfo,
        getCatalogModelConfig,
    } = require("../out/catalogModels.js");

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

    // Effort variants are optional in OpenCode. The extension must defer to
    // the provider by default instead of selecting the highest advertised tier.
    assert.equal(inferDefaultReasoningEffort({
        id: "hy3",
        reasoning: true,
        reasoning_options: [{ type: "effort", values: ["none", "low", "high"] }],
    }), "default");
    assert.equal(inferDefaultReasoningEffort({
        id: "muse-spark-1.2-contributor",
        reasoning: true,
        reasoning_options: [{ type: "effort", values: ["minimal", "low", "medium", "high", "xhigh"] }],
    }), "default");
    assert.equal(inferDefaultReasoningEffort({
        id: "always-thinking",
        reasoning: true,
        reasoning_options: [],
    }), "enabled");

    const hyInfo = buildCatalogModelInfo("opencode-go", "hy3");
    assert.deepEqual(
        hyInfo.configurationSchema.properties.reasoningEffort.enum,
        ["default", "disabled", "low", "high"],
    );
    assert.equal(hyInfo.configurationSchema.properties.reasoningEffort.default, "default");
    assert.equal(getCatalogModelConfig("hy3").reasoning_effort, undefined);

    const museInfo = buildCatalogModelInfo("opencode-go", "muse-spark-1.2-contributor");
    assert.deepEqual(
        museInfo.configurationSchema.properties.reasoningEffort.enum,
        ["default", "minimal", "low", "medium", "high", "xhigh"],
    );
    assert.equal(museInfo.configurationSchema.properties.reasoningEffort.default, "default");
    assert.equal(getCatalogModelConfig("muse-spark-1.2-contributor").reasoning_effort, undefined);

    // The historical GLM override remains explicit, while "default" stays
    // available for users who want to opt back into provider behaviour.
    const glmInfo = buildCatalogModelInfo("opencode-go", "glm-5.2");
    assert.equal(glmInfo.configurationSchema.properties.reasoningEffort.default, "high");
    assert.ok(glmInfo.configurationSchema.properties.reasoningEffort.enum.includes("default"));
    const glmConfig = getCatalogModelConfig("glm-5.2");
    assert.equal(glmConfig.reasoning_effort, "high");
    applyReasoningEffortSelection(glmConfig, "default");
    assert.equal(glmConfig.reasoning_effort, undefined);
    assert.equal(glmConfig.enable_thinking, true);
    assert.equal(glmConfig.include_reasoning_in_request, true);

    const disabledHyConfig = getCatalogModelConfig("hy3");
    applyReasoningEffortSelection(disabledHyConfig, "disabled");
    assert.equal(disabledHyConfig.enable_thinking, false);
    assert.equal(disabledHyConfig.include_reasoning_in_request, false);

    const explicitHyConfig = getCatalogModelConfig("hy3");
    applyReasoningEffortSelection(explicitHyConfig, "high");
    assert.equal(explicitHyConfig.reasoning_effort, "high");

    console.log("api mode resolution: ok");
} finally {
    Module._load = originalLoad;
    globalThis.fetch = originalFetch;
}
