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
};

Module._load = function (request, parent, isMain) {
    if (request === "vscode") {
        return vscodeShim;
    }
    return originalLoad.call(this, request, parent, isMain);
};

try {
    const { buildCatalogModelInfo } = require("../out/catalogModels.js");

    for (const modelId of ["glm-5.3", "qwen3.8-max", "claude-haiku-5-5"]) {
        const modelInfo = buildCatalogModelInfo("opencode-go", modelId);

        assert.equal(modelInfo.id, modelId);
        assert.equal(modelInfo.isUserSelectable, true);
        assert.ok(modelInfo.maxInputTokens > 0);
        assert.ok(modelInfo.maxOutputTokens > 0);
        assert.equal(typeof modelInfo.family, "string");
        assert.equal(typeof modelInfo.detail, "string");
        assert.equal(typeof modelInfo.capabilities.toolCalling, "boolean");
        assert.equal(modelInfo.capabilities.imageInput, true);
        assert.equal(modelInfo.id.includes("/"), false);
    }

    console.log("provider model contract: ok");
} finally {
    Module._load = originalLoad;
}
