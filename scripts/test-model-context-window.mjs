/**
 * Guards the context-window numbers reported to VS Code.
 *
 * VS Code renders the model picker's "Max context" from
 * `maxContextWindowTokens` when a provider reports it, and otherwise sums
 * `maxInputTokens + maxOutputTokens`. Reporting a 1M-token model as 1M input
 * plus 384K output therefore displayed 1.3M (#149), so the catalog builder must
 * declare the real window explicitly.
 *
 * The window is the catalog's `limit.context`; it is *not* input + output.
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

// Keep the test offline: make the catalog fetch fail so the loader falls back
// to the hardcoded snapshot instead of hitting models.dev.
globalThis.fetch = async () => {
    throw new Error("offline test");
};

try {
    // The catalog loader logs its fallback through the singleton logger, which
    // needs an output channel: initialise it against the shim first.
    require("../out/logger.js").logger.init();

    const { buildCatalogModelInfo } = require("../out/catalogModels.js");
    const { ensureModelsDevLoaded, getCatalogProviderModelIds } = require("../out/modelsDev.js");

    await ensureModelsDevLoaded();

    // DeepSeek V4.1 Flash: 1M window, 384K max output. The picker must show 1M,
    // not the summed 1.384M it derived before this field existed.
    const flash = buildCatalogModelInfo("opencode-go", "deepseek-v4.1-flash");
    assert.equal(flash.maxInputTokens, 1000000, "deepseek-v4.1-flash maxInputTokens");
    assert.equal(flash.maxOutputTokens, 384000, "deepseek-v4.1-flash maxOutputTokens");
    assert.equal(flash.maxContextWindowTokens, 1000000, "deepseek-v4.1-flash maxContextWindowTokens");

    // Every catalog model reports the window, and it always equals the resolved
    // context length — never the sum of the per-direction maxima.
    const modelIds = getCatalogProviderModelIds("opencode-go");
    assert.ok(modelIds.length > 0, "catalog must expose models");
    for (const modelId of modelIds) {
        const info = buildCatalogModelInfo("opencode-go", modelId);
        assert.equal(typeof info.maxContextWindowTokens, "number", modelId);
        assert.equal(info.maxContextWindowTokens, info.maxInputTokens, modelId);
    }

    console.log(`test-model-context-window: ok (${modelIds.length} models)`);
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    Module._load = originalLoad;
}
