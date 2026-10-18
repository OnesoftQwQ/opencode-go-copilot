/**
 * Regression checks for #144: usage and model-list requests must always use
 * the official control-plane base (zen), never the catalog's inference base.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
const originalFetch = globalThis.fetch;

const vscodeShim = {
    env: { language: "en", appRoot: "/nonexistent" },
    workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) },
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
    if (request === "vscode") return vscodeShim;
    return originalLoad.call(this, request, parent, isMain);
};

const requests = [];

try {
    const { logger } = require("../out/logger.js");
    logger.init();
    const { OFFICIAL_CONTROL_PLANE_BASE_URL } = require("../out/endpoints.js");
    const { getGoUsageCached } = require("../out/goUsage.js");
    const { getApiModelIds, clearApiModelCache } = require("../out/apiModelList.js");

    assert.equal(OFFICIAL_CONTROL_PLANE_BASE_URL, "https://opencode.ai/zen/go/v1/");

    globalThis.fetch = async (url) => {
        requests.push(String(url));
        return new Response(
            JSON.stringify({
                usage: {
                    rolling: { percent: 65, resetsAt: "2030-01-01T00:00:00.000Z" },
                    weekly: { percent: 30 },
                    monthly: { percent: 12 },
                },
            }),
            { status: 200 },
        );
    };

    const usage = await getGoUsageCached("test-key", true);
    assert.equal(requests.at(-1), "https://opencode.ai/zen/go/v1/usage");
    assert.equal(usage?.rolling?.percent, 65);
    assert.equal(usage?.weekly?.percent, 30);
    assert.equal(usage?.monthly?.percent, 12);

    clearApiModelCache();
    globalThis.fetch = async (url) => {
        requests.push(String(url));
        return new Response(
            JSON.stringify({ object: "list", data: [{ id: "deepseek-v4-flash" }, { id: "gemini-4-argon-contributor" }] }),
            { status: 200 },
        );
    };

    const ids = await getApiModelIds("test-key");
    assert.equal(requests.at(-1), "https://opencode.ai/zen/go/v1/models");
    assert.equal(ids.has("gemini-4-argon-contributor"), true);

    assert.equal(
        requests.some((url) => url.includes("/inference/")),
        false,
        "control-plane requests must not use the catalog inference base",
    );

    console.log("control-plane base: ok");
} finally {
    Module._load = originalLoad;
    globalThis.fetch = originalFetch;
}
