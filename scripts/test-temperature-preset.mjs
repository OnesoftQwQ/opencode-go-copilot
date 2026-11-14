/**
 * Guards the temperature/top_p request contract (issues #151, #152).
 *
 * Issue #151: OpenCode v2 no longer sends a temperature, so the extension's
 * default preset must leave both parameters out and let each model use its
 * own provider default.
 *
 * Issue #152: the serving route may reject the parameter
 * ("Unsupported parameter: 'temperature' is not supported with this model")
 * even when the catalog advertises support — gpt-6-luna does. Per-model
 * overrides must therefore win over the catalog.
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

// Serve a catalog that (like the real models.dev data) advertises temperature
// support for the GPT Luna models, so the override path is what the assertions
// cover. Both are served over the Responses protocol, where the parameter is
// rejected with 400 (verified against the live API).
const LUNA_MODELS = ["gpt-5.6-luna", "gpt-6-luna"];
const lunaEntry = (id) => ({
    id,
    name: id === "gpt-6-luna" ? "GPT-6 Luna" : "GPT-5.6 Luna",
    reasoning: true,
    tool_call: true,
    temperature: true,
    limit: { context: 1050000, output: 128000 },
});

const catalog = {
    models: Object.fromEntries(LUNA_MODELS.map((id) => ["openai/" + id, lunaEntry(id)])),
    providers: {
        "opencode-go": {
            id: "opencode-go",
            api: "https://opencode.ai/zen/go/v1/",
            name: "OpenCode Go",
            models: Object.fromEntries(LUNA_MODELS.map((id) => [id, lunaEntry(id)])),
        },
    },
};

globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(catalog),
});

try {
    require("../out/logger.js").logger.init();

    const { ensureModelsDevLoaded } = require("../out/modelsDev.js");
    await ensureModelsDevLoaded();

    const { getCatalogModelConfig } = require("../out/catalogModels.js");
    const { applyTemperaturePreset, DEFAULT_PRESET_ID } = require("../out/temperaturePreset.js");
    const { OpenaiApi } = require("../out/openai/openaiApi.js");
    const { ResponsesApi } = require("../out/openai/responsesApi.js");
    const { AnthropicApi } = require("../out/anthropic/anthropicApi.js");

    // ── Issue #152: the GPT Luna models never receive temperature/top_p ──
    for (const modelId of LUNA_MODELS) {
        const luna = getCatalogModelConfig(modelId);
        assert.equal(luna.supportsTemperature, false, modelId + ": override must beat the catalog");

        const lunaWithPreset = { ...luna, temperature: 0, top_p: 0.9 };
        applyTemperaturePreset(lunaWithPreset, "precise", [
            { id: "precise", label: "Precise", temperature: 0 },
        ], null, null);
        assert.equal(lunaWithPreset.temperature, undefined, modelId);
        assert.equal(lunaWithPreset.top_p, undefined, modelId);

        const chatBody = new OpenaiApi(modelId).prepareRequestBody(
            { model: modelId, messages: [], stream: true },
            lunaWithPreset,
        );
        assert.equal("temperature" in chatBody, false, modelId + ": chat completion temperature");

        const responsesBody = new ResponsesApi(modelId).prepareRequestBody(
            { model: modelId, input: [], stream: true, store: false },
            lunaWithPreset,
        );
        assert.equal("temperature" in responsesBody, false, modelId + ": responses temperature");

        const anthropicBody = new AnthropicApi(modelId).prepareRequestBody(
            { max_tokens: 4096, messages: [] },
            lunaWithPreset,
        );
        assert.equal("temperature" in anthropicBody, false, modelId + ": anthropic temperature");
    }

    // ── Issue #151: the default preset sends nothing ──
    const presets = [
        { id: "default", label: "Default" },
        { id: "precise", label: "Precise", temperature: 0 },
        { id: "balanced", label: "Balanced", temperature: 1, top_p: 0.9 },
    ];

    const merged = { id: "deepseek-v4-pro", owned_by: "opencode" };
    applyTemperaturePreset(merged, DEFAULT_PRESET_ID, presets, 0.7, 0.5);
    assert.equal(merged.temperature, undefined, "default preset temperature");
    assert.equal(merged.top_p, undefined, "default preset top_p");

    const mergedBody = new OpenaiApi("deepseek-v4-pro").prepareRequestBody({}, merged);
    assert.equal("temperature" in mergedBody, false, "default preset chat body");
    assert.equal("top_p" in mergedBody, false, "default preset chat body top_p");

    // A preset still overrides the provider default when selected explicitly.
    const precise = { id: "deepseek-v4-pro", owned_by: "opencode" };
    applyTemperaturePreset(precise, "precise", presets, 0.7, 0.5);
    assert.equal(precise.temperature, 0, "precise preset temperature");
    assert.equal(precise.top_p, undefined, "presets never send top_p");

    // Custom mode uses the manual settings; an unset top_p stays omitted.
    const custom = { id: "deepseek-v4-pro", owned_by: "opencode" };
    applyTemperaturePreset(custom, "custom", presets, 0.7, 0.5);
    assert.equal(custom.temperature, 0.7);
    assert.equal(custom.top_p, 0.5);

    const customNoTopP = { id: "deepseek-v4-pro", owned_by: "opencode" };
    applyTemperaturePreset(customNoTopP, "custom", presets, 0.7, null);
    assert.equal(customNoTopP.temperature, 0.7);
    assert.equal(customNoTopP.top_p, undefined);

    // An unknown preset id must not fall back to a hardcoded temperature.
    const unknown = { id: "deepseek-v4-pro", owned_by: "opencode" };
    applyTemperaturePreset(unknown, "no-such-preset", presets, 0.7, 0.5);
    assert.equal(unknown.temperature, undefined);

    console.log("test-temperature-preset: ok");
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    Module._load = originalLoad;
}
