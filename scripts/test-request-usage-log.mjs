import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

// requestUsageLog.ts has no runtime VS Code dependency, but its type-only
// import chain does, so keep the same shim as the other script tests.
const vscodeShim = {
    window: {
        createOutputChannel: () => ({
            debug() {},
            info() {},
            warn() {},
            error() {},
            dispose() {},
        }),
    },
    workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) },
};

Module._load = function (request, parent, isMain) {
    if (request === "vscode") return vscodeShim;
    return originalLoad.call(this, request, parent, isMain);
};

try {
    const { computeCacheHitRate, formatCacheHitRate, buildRequestUsageLog } = require("../out/requestUsageLog.js");

    // --- computeCacheHitRate: normal cases ---------------------------------
    assert.equal(computeCacheHitRate({ promptTokens: 1000, completionTokens: 10, cacheHitTokens: 834 }), 83.4);
    assert.equal(computeCacheHitRate({ promptTokens: 100, completionTokens: 1, cacheHitTokens: 100 }), 100);
    assert.equal(computeCacheHitRate({ promptTokens: 100, completionTokens: 1, cacheHitTokens: 0 }), 0);
    // 1/3 -> 33.333...% is reported rounded to one decimal place
    assert.equal(computeCacheHitRate({ promptTokens: 3, completionTokens: 1, cacheHitTokens: 1 }), 33.3);

    // --- computeCacheHitRate: missing cache field -> null (not NaN) --------
    assert.equal(computeCacheHitRate({ promptTokens: 500, completionTokens: 5 }), null);
    assert.equal(computeCacheHitRate(undefined), null);
    assert.equal(computeCacheHitRate({ promptTokens: 0, completionTokens: 0, cacheHitTokens: 0 }), null);
    assert.equal(computeCacheHitRate({ promptTokens: -10, completionTokens: 0, cacheHitTokens: 5 }), null);
    assert.equal(
        computeCacheHitRate({ promptTokens: Number.NaN, completionTokens: 0, cacheHitTokens: 1 }),
        null,
    );
    assert.equal(
        computeCacheHitRate({ promptTokens: Number.POSITIVE_INFINITY, completionTokens: 0, cacheHitTokens: 1 }),
        null,
    );
    assert.equal(
        computeCacheHitRate({ promptTokens: 100, completionTokens: 0, cacheHitTokens: Number.NaN }),
        null,
    );
    assert.equal(computeCacheHitRate({ promptTokens: 100, completionTokens: 0, cacheHitTokens: -1 }), null);

    // --- computeCacheHitRate: cacheHit > input is clamped, never > 100 -----
    assert.equal(computeCacheHitRate({ promptTokens: 100, completionTokens: 1, cacheHitTokens: 150 }), 100);
    assert.equal(computeCacheHitRate({ promptTokens: 1, completionTokens: 1, cacheHitTokens: 1e9 }), 100);

    // --- formatting: one decimal place, no NaN/Infinity --------------------
    assert.equal(formatCacheHitRate(83.4), "83.4");
    assert.equal(formatCacheHitRate(100 / 3), "33.3");
    assert.equal(formatCacheHitRate(0), "0.0");
    assert.equal(formatCacheHitRate(100), "100.0");

    // --- buildRequestUsageLog: streamed usage ------------------------------
    const streamed = buildRequestUsageLog(
        {
            promptTokens: 1000,
            completionTokens: 42,
            cacheHitTokens: 834,
            cacheMissTokens: 166,
        },
        { modelId: "deepseek-v4-flash", durationMs: 1234, usageSource: "stream" },
    );
    assert.deepEqual(streamed, {
        modelId: "deepseek-v4-flash",
        durationMs: 1234,
        inputTokens: 1000,
        cachedTokens: 834,
        cacheMissTokens: 166,
        outputTokens: 42,
        cacheHitRate: 83.4,
        cacheHitRateText: "83.4%",
        usageSource: "stream",
    });

    // --- buildRequestUsageLog: no cache fields -> explicit "n/a" -----------
    const noCache = buildRequestUsageLog(
        { promptTokens: 700, completionTokens: 7 },
        { modelId: "glm-5", durationMs: 10, usageSource: "stream" },
    );
    assert.equal(noCache.cacheHitRate, null);
    assert.equal(noCache.cacheHitRateText, "n/a");
    assert.equal(noCache.cachedTokens, null);
    assert.equal(noCache.cacheMissTokens, null);
    assert.equal(noCache.inputTokens, 700);
    assert.equal(noCache.outputTokens, 7);

    // --- buildRequestUsageLog: no usage at all (failed request) ------------
    const none = buildRequestUsageLog(undefined, { modelId: "glm-5", durationMs: 5, usageSource: "none" });
    assert.equal(none.inputTokens, null);
    assert.equal(none.outputTokens, null);
    assert.equal(none.cacheHitRate, null);
    assert.equal(none.cacheHitRateText, "n/a");
    assert.equal(none.usageSource, "none");

    // --- buildRequestUsageLog: estimated fallback has no cache data --------
    const estimated = buildRequestUsageLog(
        { promptTokens: 300, completionTokens: 20 },
        { modelId: "glm-5", durationMs: 77, usageSource: "estimated" },
    );
    assert.equal(estimated.usageSource, "estimated");
    assert.equal(estimated.cacheHitRateText, "n/a");
    assert.equal(JSON.stringify(estimated).includes("NaN"), false);
    assert.equal(JSON.stringify(estimated).includes("Infinity"), false);

    // --- buildRequestUsageLog: promptTokens=0 must not produce NaN ---------
    const zeroInput = buildRequestUsageLog(
        { promptTokens: 0, completionTokens: 0, cacheHitTokens: 0 },
        { modelId: "glm-5", durationMs: 1, usageSource: "stream" },
    );
    assert.equal(zeroInput.cacheHitRate, null);
    assert.equal(zeroInput.cacheHitRateText, "n/a");

    console.log("[test-request-usage-log] all assertions passed");
} catch (e) {
    console.error("[test-request-usage-log] failed:", e);
    process.exit(1);
}
