/**
 * Focused checks for the shared HTTP transport (network.ts): proxy URL
 * normalization, bypass rules, connect tuning (#165) and dispatcher selection
 * between direct / proxy agents (#160).
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

const settings = {
    proxy: "",
    proxyNoProxy: [],
    "connect.attemptTimeoutMs": 3000,
    "connect.autoSelectFamily": true,
    requestTimeout: 600000,
};

const configListeners = [];

const vscodeShim = {
    env: { language: "en" },
    workspace: {
        getConfiguration: () => ({
            get: (key, fallback) => (Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback),
        }),
        onDidChangeConfiguration: (listener) => {
            configListeners.push(listener);
            return { dispose() {} };
        },
    },
    Disposable: class {
        constructor(fn) {
            this._fn = fn;
        }
        dispose() {
            this._fn();
        }
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

// Fake undici: records the dispatcher each fetch is issued with.
const agents = [];
const proxyAgents = [];
const fetches = [];

class FakeAgent {
    constructor(options) {
        this.options = options;
        this.kind = "agent";
        this.destroyed = false;
        agents.push(this);
    }
    destroy() {
        this.destroyed = true;
    }
}

class FakeProxyAgent {
    constructor(options) {
        this.options = options;
        this.kind = "proxy";
        this.destroyed = false;
        proxyAgents.push(this);
    }
    destroy() {
        this.destroyed = true;
    }
}

function fakeFetch(url, init) {
    fetches.push({ url, dispatcher: init?.dispatcher });
    return Promise.resolve(new Response("{}", { status: 200 }));
}

Module._load = function (request, parent, isMain) {
    if (request === "vscode") {
        return vscodeShim;
    }
    if (request === "undici") {
        return { Agent: FakeAgent, ProxyAgent: FakeProxyAgent, fetch: fakeFetch };
    }
    return originalLoad.call(this, request, parent, isMain);
};

try {
    // network.ts logs through the shared logger, which needs an output channel.
    const { logger } = require("../out/logger.js");
    logger.init();

    const {
        normalizeProxyUrl,
        readNoProxy,
        resolveConnectTuning,
        shouldBypassProxy,
        createNetworkFetch,
        initNetwork,
    } = require("../out/network.js");

    // --- proxy URL normalization -------------------------------------------
    assert.equal(normalizeProxyUrl(""), undefined);
    assert.equal(normalizeProxyUrl("   "), undefined);
    assert.equal(normalizeProxyUrl(undefined), undefined);
    assert.equal(normalizeProxyUrl("127.0.0.1:7897"), "http://127.0.0.1:7897/");
    assert.equal(normalizeProxyUrl(" http://127.0.0.1:7897 "), "http://127.0.0.1:7897/");
    assert.equal(normalizeProxyUrl("https://proxy.example.com:8443"), "https://proxy.example.com:8443/");
    // Only HTTP(S) proxies are reachable through undici's ProxyAgent.
    assert.equal(normalizeProxyUrl("socks5://127.0.0.1:1080"), undefined);
    assert.equal(normalizeProxyUrl("not a url"), undefined);

    // --- noProxy parsing ---------------------------------------------------
    settings.proxyNoProxy = [];
    assert.deepEqual(readNoProxy({ get: (key, fallback) => fallback }), []);
    assert.deepEqual(
        readNoProxy({ get: () => [" Example.com ", "", ".internal.test"] }),
        ["example.com", ".internal.test"]
    );
    assert.deepEqual(readNoProxy({ get: () => "a.test, B.test ,, c.test" }), ["a.test", "b.test", "c.test"]);

    // --- connect tuning (#165) ---------------------------------------------
    const tuningOf = (attempt, family) =>
        resolveConnectTuning({
            get: (key, fallback) => {
                if (key === "connect.attemptTimeoutMs") {
                    return attempt ?? fallback;
                }
                if (key === "connect.autoSelectFamily") {
                    return family ?? fallback;
                }
                return fallback;
            },
        });

    assert.deepEqual(tuningOf(undefined, undefined), {
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 3000,
    });
    assert.equal(tuningOf(5000, false).autoSelectFamilyAttemptTimeout, 5000);
    assert.equal(tuningOf(5000, false).autoSelectFamily, false);
    // Below Node's 250 ms floor and above the sane ceiling are clamped.
    assert.equal(tuningOf(10, true).autoSelectFamilyAttemptTimeout, 250);
    assert.equal(tuningOf(120000, true).autoSelectFamilyAttemptTimeout, 60000);
    // Garbage falls back to the default window.
    assert.equal(tuningOf(Number.NaN, true).autoSelectFamilyAttemptTimeout, 3000);

    // --- bypass rules ------------------------------------------------------
    for (const url of [
        "http://localhost:8080/v1",
        "http://127.0.0.1:8080",
        "http://127.1.2.3:9000",
        "http://[::1]:3000",
        "https://api.localhost/v1",
        "http://0.0.0.0:1234",
    ]) {
        assert.equal(shouldBypassProxy(url, []), true, `${url} must bypass the proxy`);
    }
    assert.equal(shouldBypassProxy("https://opencode.ai/zen/go/v1", []), false);
    assert.equal(shouldBypassProxy("https://opencode.ai/zen/go/v1", ["example.com"]), false);
    assert.equal(shouldBypassProxy("https://opencode.ai/zen/go/v1", ["*"]), true);
    assert.equal(shouldBypassProxy("https://opencode.ai/zen/go/v1", ["opencode.ai"]), true);
    assert.equal(shouldBypassProxy("https://a.models.dev/x", ["models.dev"]), true);
    assert.equal(shouldBypassProxy("https://a.models.dev/x", [".models.dev"]), true);
    assert.equal(shouldBypassProxy("https://models.dev/x", [".models.dev"]), true);
    assert.equal(shouldBypassProxy("https://a.models.dev/x", ["*.models.dev"]), true);
    assert.equal(shouldBypassProxy("https://notmodels.dev/x", ["models.dev"]), false);
    // Full URLs and host:port entries are accepted too.
    assert.equal(shouldBypassProxy("https://opencode.ai/x", ["https://opencode.ai"]), true);
    assert.equal(shouldBypassProxy("https://opencode.ai/x", ["opencode.ai:443"]), true);

    // --- dispatcher selection (#160) ---------------------------------------
    const doFetch = createNetworkFetch(600000);
    const callWith = async (url) => {
        await doFetch(url, {});
        return fetches[fetches.length - 1].dispatcher;
    };

    // Direct by default: one agent carrying the connect tuning.
    settings.proxy = "";
    const directDispatcher = await callWith("https://opencode.ai/zen/go/v1/chat/completions");
    assert.equal(directDispatcher.kind, "agent");
    assert.equal(directDispatcher.options.bodyTimeout, 600000);
    assert.deepEqual(directDispatcher.options.connect, {
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 3000,
    });

    // Configuring a proxy switches remote requests to the ProxyAgent...
    settings.proxy = "127.0.0.1:7897";
    const proxiedDispatcher = await callWith("https://opencode.ai/zen/go/v1/chat/completions");
    assert.equal(proxiedDispatcher.kind, "proxy");
    assert.equal(proxiedDispatcher.options.uri, "http://127.0.0.1:7897/");
    assert.equal(proxiedDispatcher.options.bodyTimeout, 600000);

    // ...while a local gateway still connects directly (no self-loop).
    const bypassDispatcher = await callWith("http://127.0.0.1:8080/v1/chat/completions");
    assert.equal(bypassDispatcher.kind, "agent");

    // noProxy entries are honored.
    settings.proxyNoProxy = ["models.dev"];
    const catalogDispatcher = await callWith("https://models.dev/catalog.json");
    assert.equal(catalogDispatcher.kind, "agent");
    settings.proxyNoProxy = [];

    // Unparseable proxy values keep requests direct instead of failing.
    settings.proxy = "socks5://127.0.0.1:1080";
    const invalidProxyDispatcher = await callWith("https://opencode.ai/zen/go/v1/chat/completions");
    assert.equal(invalidProxyDispatcher.kind, "agent");
    settings.proxy = "";

    // Dispatchers are reused across requests with the same options.
    const agentCount = agents.length;
    await callWith("https://opencode.ai/zen/go/v1/models");
    assert.equal(agents.length, agentCount);

    // --- lifecycle: settings changes drop pooled sockets -------------------
    const context = { subscriptions: [] };
    initNetwork(context);
    assert.equal(context.subscriptions.length, 2);
    assert.equal(configListeners.length, 1);

    await callWith("https://opencode.ai/zen/go/v1/chat/completions");
    assert.equal(agents.some((agent) => !agent.destroyed), true);

    configListeners[0]({ affectsConfiguration: (key) => key === "opencodego.connect.attemptTimeoutMs" });
    assert.equal(agents.every((agent) => agent.destroyed), true);
    assert.equal(proxyAgents.every((agent) => agent.destroyed), true);

    // Unrelated settings changes keep the pool alive.
    settings.proxy = "127.0.0.1:7897";
    await callWith("https://opencode.ai/zen/go/v1/chat/completions");
    configListeners[0]({ affectsConfiguration: (key) => key === "opencodego.temperature" });
    assert.equal(proxyAgents.some((agent) => !agent.destroyed), true);

    console.log("network transport: ok");
} finally {
    Module._load = originalLoad;
}
