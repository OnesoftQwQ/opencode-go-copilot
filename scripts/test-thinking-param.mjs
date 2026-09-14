/**
 * Focused checks for the `thinking` request-body capability (supportsThinkingParam).
 *
 * GLM-5.3 / GLM-5.3-Flash on OpenCode Go reject the Chat Completions
 * `thinking` field entirely (HTTP 400 `json: unknown field "thinking"`), so
 * requests must carry only `reasoning_effort` (low/high/max) and the model
 * picker must not offer an off switch thinking cannot honour.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

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
    const { buildCatalogModelInfo, getCatalogModelConfig } = require("../out/catalogModels.js");
    const { OpenaiApi } = require("../out/openai/openaiApi.js");
    const { AnthropicApi } = require("../out/anthropic/anthropicApi.js");

    // Both always-thinking GLM-5.3 variants are effort-only: no `thinking`
    // field, no "禁用思考" picker entry.
    for (const modelId of ["glm-5.3", "glm-5.3-flash"]) {
        const config = getCatalogModelConfig(modelId);
        assert.equal(config.thinkingMode, "always", modelId);
        assert.equal(config.supportsThinkingParam, false, modelId);

        const reasoningEffort = buildCatalogModelInfo("opencode-go", modelId)
            .configurationSchema.properties.reasoningEffort;
        assert.equal(reasoningEffort.enum.includes("disabled"), false, modelId);
        assert.ok(reasoningEffort.enum.length > 0, modelId);
    }

    // GLM-5.2 keeps its off switch: the route accepts `thinking: disabled`.
    const glm52 = getCatalogModelConfig("glm-5.2");
    assert.notEqual(glm52.supportsThinkingParam, false);
    assert.equal(glm52.thinkingMode, "switchable");
    const glm52Efforts = buildCatalogModelInfo("opencode-go", "glm-5.2")
        .configurationSchema.properties.reasoningEffort.enum;
    assert.equal(glm52Efforts.includes("disabled"), true);

    // Chat Completions: omit `thinking` when the route rejects it, but still
    // forward the effort that controls the always-on thinking strength.
    const openaiApi = new OpenaiApi("glm-5.3-flash");
    const openaiBody = openaiApi.prepareRequestBody(
        { model: "glm-5.3-flash", messages: [], stream: true },
        {
            id: "glm-5.3-flash",
            enable_thinking: true,
            reasoning_effort: "max",
            supportsThinkingParam: false,
            max_completion_tokens: 131072,
        }
    );
    assert.equal("thinking" in openaiBody, false);
    assert.equal(openaiBody.reasoning_effort, "max");
    assert.equal(openaiBody.max_completion_tokens, 131072);

    // A stale "disabled" selection must not reintroduce the rejected field.
    const openaiDisabledBody = openaiApi.prepareRequestBody({}, {
        id: "glm-5.3-flash",
        enable_thinking: false,
        supportsThinkingParam: false,
    });
    assert.equal("thinking" in openaiDisabledBody, false);

    // Models on routes that accept the field keep the previous behaviour.
    const regularApi = new OpenaiApi("glm-5.2");
    const enabledBody = regularApi.prepareRequestBody({}, {
        id: "glm-5.2",
        enable_thinking: true,
        reasoning_effort: "high",
    });
    assert.deepEqual(enabledBody.thinking, { type: "enabled" });
    assert.equal(enabledBody.reasoning_effort, "high");
    const disabledBody = regularApi.prepareRequestBody({}, {
        id: "glm-5.2",
        enable_thinking: false,
    });
    assert.deepEqual(disabledBody.thinking, { type: "disabled" });

    // The Anthropic-compatible adapter honours the same capability flag.
    const anthropicApi = new AnthropicApi("glm-5.3-flash");
    const anthropicBody = anthropicApi.prepareRequestBody({ max_tokens: 4096, messages: [] }, {
        id: "glm-5.3-flash",
        enable_thinking: true,
        reasoning_effort: "max",
        supportsThinkingParam: false,
    });
    assert.equal("thinking" in anthropicBody, false);

    console.log("thinking param: ok");
} finally {
    Module._load = originalLoad;
}
