/**
 * Focused checks for the inference base URL override helpers (utils.ts).
 *
 * Covers the HTTP safety rules shared by the provider, Git commit generation,
 * and the `opencodego.setInferenceBaseUrl` command input validation, plus the
 * override read helper.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

let configuredBaseUrl = "";

const vscodeShim = {
    env: { language: "en" },
    workspace: {
        getConfiguration: () => ({
            get: (key, fallback) =>
                key === "opencodego.inferenceBaseUrl" ? configuredBaseUrl || fallback : fallback,
        }),
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
    const { getInferenceBaseUrlOverride, validateBaseUrl } = require("../out/utils.js");

    // The override is empty when unset and trimmed when configured.
    assert.equal(getInferenceBaseUrlOverride(), "");
    configuredBaseUrl = "  https://proxy.example.com/zen/go/v1/  ";
    assert.equal(getInferenceBaseUrlOverride(), "https://proxy.example.com/zen/go/v1/");
    configuredBaseUrl = "";

    // HTTPS is always accepted; plain HTTP only for localhost/private networks.
    assert.equal(validateBaseUrl("https://proxy.example.com/zen/go/v1/"), undefined);
    assert.equal(validateBaseUrl("https://example.com"), undefined);
    assert.equal(validateBaseUrl("http://localhost:8080/v1"), undefined);
    assert.equal(validateBaseUrl("http://127.0.0.1:8080"), undefined);
    assert.equal(validateBaseUrl("http://[::1]:3000"), undefined);
    assert.equal(validateBaseUrl("http://192.168.1.10:8080"), undefined);
    assert.equal(validateBaseUrl("http://10.0.0.5"), undefined);
    assert.equal(validateBaseUrl("http://172.16.0.9"), undefined);
    assert.equal(validateBaseUrl("http://172.31.255.254"), undefined);
    assert.equal(validateBaseUrl("http://0.0.0.0:9999"), undefined);

    // Invalid inputs produce localized error messages.
    const invalid = "Invalid base URL configuration.";
    const plainHttp = "Plain HTTP is only allowed for localhost or private network addresses. Use HTTPS for remote endpoints.";
    assert.equal(validateBaseUrl(""), invalid);
    assert.equal(validateBaseUrl("   "), invalid);
    assert.equal(validateBaseUrl("not a url"), invalid);
    assert.equal(validateBaseUrl("ftp://example.com"), invalid);
    assert.equal(validateBaseUrl("file:///tmp/socket"), invalid);
    assert.equal(validateBaseUrl("http://example.com"), plainHttp);
    assert.equal(validateBaseUrl("http://172.32.0.1"), plainHttp);
    assert.equal(validateBaseUrl("http://172.15.0.1"), plainHttp);

    console.log("base url override: ok");
} finally {
    Module._load = originalLoad;
}
