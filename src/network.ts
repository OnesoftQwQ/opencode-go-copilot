/**
 * Shared HTTP transport for every outbound request the extension makes.
 *
 * Two problems are fixed here:
 *
 * - #165: requests used a bare `undici.Agent` without `connect` tuning, so
 *   Node's default `autoSelectFamilyAttemptTimeout` (250 ms) aborted viable
 *   IPv4 handshakes on slow cross-border links. The per-address window was
 *   too short, the attempt was dropped, and the whole request surfaced as
 *   `AggregateError` / `fetch failed` / `Connection error`.
 * - #160: the same agent ignored proxy configuration entirely, bypassing both
 *   the OS proxy and `HTTP(S)_PROXY`. Users behind a local proxy (Clash /
 *   V2Ray) were pinned to a lossy direct route.
 *
 * Both knobs are exposed as settings. `opencodego.proxy` is empty by default,
 * so the direct behaviour Remote-SSH users need (#98) is unchanged.
 *
 * undici is declared as an extension dependency instead of being required
 * from `vscode.env.appRoot`: VS Code 1.147 no longer ships
 * `resources/app/node_modules/undici`, so the old lookup silently fell back
 * to the global fetch, where a dispatcher cannot be injected at all.
 */

import * as net from "net";
import * as vscode from "vscode";
import type * as Undici from "undici";
import { logger } from "./logger";

const CONFIG_SECTION = "opencodego";

/** Settings that describe the transport; changing any of them rebuilds dispatchers. */
export const NETWORK_CONFIG_KEYS = [
    `${CONFIG_SECTION}.proxy`,
    `${CONFIG_SECTION}.proxyNoProxy`,
    `${CONFIG_SECTION}.connect.attemptTimeoutMs`,
    `${CONFIG_SECTION}.connect.autoSelectFamily`,
] as const;

const PROXY_KEY = "proxy";
const NO_PROXY_KEY = "proxyNoProxy";
const ATTEMPT_TIMEOUT_KEY = "connect.attemptTimeoutMs";
const AUTO_SELECT_FAMILY_KEY = "connect.autoSelectFamily";
const REQUEST_TIMEOUT_KEY = "requestTimeout";

const DEFAULT_ATTEMPT_TIMEOUT_MS = 3000;
const MIN_ATTEMPT_TIMEOUT_MS = 250;
const MAX_ATTEMPT_TIMEOUT_MS = 60000;
const DEFAULT_REQUEST_TIMEOUT_MS = 600000;

/** Minimal configuration reader, so the resolvers stay unit-testable. */
export interface ConfigReader {
    get<T>(key: string, defaultValue: T): T;
}

/** Socket-level tuning applied to every undici agent (#165). */
export interface ConnectTuning {
    autoSelectFamily: boolean;
    autoSelectFamilyAttemptTimeout: number;
}

/** Snapshot of the transport-related settings. */
export interface NetworkSettings {
    /** Proxy URL, or `undefined` when requests go direct. */
    proxyUrl?: string;
    /** Hosts that bypass the proxy (loopback always bypasses). */
    noProxy: readonly string[];
    connect: ConnectTuning;
}

/** Base options understood by both `Agent` and `ProxyAgent`. */
type DispatcherOptions = Record<string, unknown>;

/** Cached dispatchers, keyed by the options they were built from. */
const dispatchers = new Map<string, Undici.Dispatcher>();

/** Proxy URLs already reported as unusable, so the warning is logged once. */
const loggedInvalidProxies = new Set<string>();

/** Proxy dispatcher keys that already failed to build; don't retry per request. */
const failedProxyDispatchers = new Set<string>();

/** `undefined` = not probed yet, `null` = unavailable. */
let undiciModule: typeof Undici | null | undefined;

/**
 * Normalize the configured proxy URL.
 *
 * @param raw - Raw `opencodego.proxy` value.
 * @returns A usable HTTP(S) proxy URL, or `undefined` when unset/invalid.
 */
export function normalizeProxyUrl(raw: unknown): string | undefined {
    if (typeof raw !== "string") {
        return undefined;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
        return undefined;
    }
    // A bare `host:port` is the common copy-paste shape; assume HTTP.
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    try {
        const parsed = new URL(withScheme);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return undefined;
        }
        return parsed.href;
    } catch {
        return undefined;
    }
}

/**
 * Read the `noProxy` bypass list, accepting both an array and a
 * comma-separated string.
 */
export function readNoProxy(config: ConfigReader): string[] {
    const raw = config.get<unknown>(NO_PROXY_KEY, []);
    const parts = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
    return parts
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
}

/**
 * Resolve the socket tuning (#165).
 *
 * Node clamps its default window to 250 ms; cross-border IPv4 handshakes often
 * need more, which is what made the failure probabilistic.
 */
export function resolveConnectTuning(config: ConfigReader): ConnectTuning {
    const rawAttempt = config.get<number>(ATTEMPT_TIMEOUT_KEY, DEFAULT_ATTEMPT_TIMEOUT_MS);
    const attempt = typeof rawAttempt === "number" && Number.isFinite(rawAttempt) ? rawAttempt : DEFAULT_ATTEMPT_TIMEOUT_MS;
    return {
        autoSelectFamily: config.get<boolean>(AUTO_SELECT_FAMILY_KEY, true) !== false,
        autoSelectFamilyAttemptTimeout: Math.min(
            Math.max(attempt, MIN_ATTEMPT_TIMEOUT_MS),
            MAX_ATTEMPT_TIMEOUT_MS
        ),
    };
}

/**
 * Read the current transport settings.
 */
export function readNetworkSettings(): NetworkSettings {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const rawProxy = config.get<string>(PROXY_KEY, "");
    const proxyUrl = normalizeProxyUrl(rawProxy);
    const trimmedProxy = rawProxy.trim();
    if (trimmedProxy && !proxyUrl && !loggedInvalidProxies.has(trimmedProxy)) {
        loggedInvalidProxies.add(trimmedProxy);
        logger.warn("network.proxy.invalid", { proxy: trimmedProxy });
    }
    return {
        proxyUrl,
        noProxy: readNoProxy(config),
        connect: resolveConnectTuning(config),
    };
}

/** Extract a hostname from a request URL, without IPv6 brackets. */
function parseHost(targetUrl: string): string | undefined {
    try {
        const hostname = new URL(targetUrl).hostname.toLowerCase();
        return hostname.replace(/^\[|\]$/g, "");
    } catch {
        return undefined;
    }
}

/** Loopback and "this host" addresses never go through a proxy. */
function isLoopbackHost(host: string): boolean {
    return (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host === "::1" ||
        host === "0:0:0:0:0:0:0:1" ||
        host === "0.0.0.0" ||
        /^127\./.test(host)
    );
}

/** Match one `noProxy` entry against a hostname (curl-style rules). */
function noProxyEntryMatches(host: string, entry: string): boolean {
    if (entry === "*") {
        return true;
    }
    // Accept a full URL, a bare `host:port`, or a plain host.
    let candidate = entry.includes("//") ? entry.slice(entry.indexOf("//") + 2) : entry;
    candidate = candidate.split("/")[0].replace(/^\[|\]$/g, "").replace(/:\d+$/, "");
    if (!candidate) {
        return false;
    }
    if (candidate.startsWith("*.")) {
        return host.endsWith(candidate.slice(1));
    }
    if (candidate.startsWith(".")) {
        return host === candidate.slice(1) || host.endsWith(candidate);
    }
    return host === candidate || host.endsWith(`.${candidate}`);
}

/**
 * Whether a request to `targetUrl` must bypass the proxy.
 *
 * Loopback always bypasses: routing a request aimed at a local gateway (for
 * example `opencodego.inferenceBaseUrl` pointing at 127.0.0.1) through the
 * proxy would either loop back into the extension's own traffic or fail.
 *
 * @param targetUrl - Absolute request URL.
 * @param noProxy - Lower-cased bypass entries.
 */
export function shouldBypassProxy(targetUrl: string, noProxy: readonly string[]): boolean {
    const host = parseHost(targetUrl);
    if (!host) {
        return false;
    }
    if (isLoopbackHost(host)) {
        return true;
    }
    return noProxy.some((entry) => noProxyEntryMatches(host, entry));
}

/** Load the bundled undici module once. */
function loadUndici(): typeof Undici | undefined {
    if (undiciModule !== undefined) {
        return undiciModule ?? undefined;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const loaded = require("undici") as typeof Undici;
        if (typeof loaded.fetch === "function" && typeof loaded.Agent === "function") {
            undiciModule = loaded;
            return loaded;
        }
        undiciModule = null;
    } catch {
        undiciModule = null;
    }
    logger.warn("network.undici.unavailable", {});
    return undefined;
}

/** Bundled undici version, used once in the activation log. */
function undiciVersion(): string {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return String((require("undici/package.json") as { version?: string }).version ?? "unknown");
    } catch {
        return "unknown";
    }
}

/** Options shared by the direct and proxy agents. */
function dispatcherOptions(bodyTimeoutMs: number, connect: ConnectTuning): DispatcherOptions {
    return {
        bodyTimeout: bodyTimeoutMs,
        connect: {
            autoSelectFamily: connect.autoSelectFamily,
            autoSelectFamilyAttemptTimeout: connect.autoSelectFamilyAttemptTimeout,
        },
    };
}

/** Direct agent, cached per body timeout and connect tuning. */
function getDirectDispatcher(
    undici: typeof Undici,
    bodyTimeoutMs: number,
    connect: ConnectTuning
): Undici.Dispatcher {
    const key = `direct|${bodyTimeoutMs}|${connect.autoSelectFamily ? 1 : 0}|${connect.autoSelectFamilyAttemptTimeout}`;
    const cached = dispatchers.get(key);
    if (cached) {
        return cached;
    }
    const dispatcher = new undici.Agent(dispatcherOptions(bodyTimeoutMs, connect) as Undici.Agent.Options);
    dispatchers.set(key, dispatcher);
    logger.debug("network.dispatcher.direct", {
        bodyTimeoutMs,
        autoSelectFamily: connect.autoSelectFamily,
        autoSelectFamilyAttemptTimeout: connect.autoSelectFamilyAttemptTimeout,
    });
    return dispatcher;
}

/**
 * Proxy dispatcher, cached per proxy URL and body timeout.
 *
 * @returns `undefined` when the proxy cannot be used, so the caller can fall
 * back to a direct connection instead of failing the request.
 */
function getProxyDispatcher(
    undici: typeof Undici,
    proxyUrl: string,
    bodyTimeoutMs: number,
    connect: ConnectTuning
): Undici.Dispatcher | undefined {
    if (typeof undici.ProxyAgent !== "function") {
        logger.warn("network.proxy.unsupported", { proxy: proxyUrl });
        return undefined;
    }
    const key = `proxy|${proxyUrl}|${bodyTimeoutMs}|${connect.autoSelectFamily ? 1 : 0}|${connect.autoSelectFamilyAttemptTimeout}`;
    const cached = dispatchers.get(key);
    if (cached) {
        return cached;
    }
    if (failedProxyDispatchers.has(key)) {
        return undefined;
    }
    try {
        const dispatcher = new undici.ProxyAgent({
            uri: proxyUrl,
            ...dispatcherOptions(bodyTimeoutMs, connect),
        } as Undici.ProxyAgent.Options);
        dispatchers.set(key, dispatcher);
        logger.info("network.proxy.enabled", { proxy: proxyUrl });
        return dispatcher;
    } catch (error) {
        failedProxyDispatchers.add(key);
        logger.warn("network.proxy.createFailed", {
            proxy: proxyUrl,
            error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
    }
}

/** Pick the dispatcher for one request. */
function pickDispatcher(undici: typeof Undici, bodyTimeoutMs: number, targetUrl: string): Undici.Dispatcher {
    const settings = readNetworkSettings();
    if (!settings.proxyUrl) {
        return getDirectDispatcher(undici, bodyTimeoutMs, settings.connect);
    }
    if (shouldBypassProxy(targetUrl, settings.noProxy)) {
        logger.debug("network.proxy.bypass", { url: targetUrl });
        return getDirectDispatcher(undici, bodyTimeoutMs, settings.connect);
    }
    return getProxyDispatcher(undici, settings.proxyUrl, bodyTimeoutMs, settings.connect)
        ?? getDirectDispatcher(undici, bodyTimeoutMs, settings.connect);
}

/** Extract the absolute URL of a fetch input, when it has one. */
function requestUrlOf(input: RequestInfo | URL): string | undefined {
    if (typeof input === "string") {
        return input;
    }
    if (input instanceof URL) {
        return input.href;
    }
    const maybeURL = (input as { url?: unknown } | undefined)?.url;
    return typeof maybeURL === "string" ? maybeURL : undefined;
}

/** Close cached dispatchers so pooled sockets are dropped. */
function disposeDispatchers(reason: string): void {
    const closed = dispatchers.size;
    for (const dispatcher of dispatchers.values()) {
        try {
            void dispatcher.destroy().catch(() => {
                // Already shut down; nothing to release.
            });
        } catch {
            // Synchronous failure (destroyed twice); ignore.
        }
    }
    dispatchers.clear();
    failedProxyDispatchers.clear();
    if (closed > 0) {
        logger.debug("network.dispatcher.disposed", { reason, closed });
    }
}

/**
 * Host-level fallback used only when undici cannot be loaded at all.
 *
 * This mutates a process-wide Node default and therefore affects other
 * extensions in the host, which is why it is the fallback and not the path
 * every request takes (#165).
 */
function applyHostNetFallback(): void {
    const { connect } = readNetworkSettings();
    try {
        net.setDefaultAutoSelectFamilyAttemptTimeout(connect.autoSelectFamilyAttemptTimeout);
        net.setDefaultAutoSelectFamily(connect.autoSelectFamily);
        logger.warn("network.fallback.hostDefault", {
            autoSelectFamily: connect.autoSelectFamily,
            autoSelectFamilyAttemptTimeout: connect.autoSelectFamilyAttemptTimeout,
        });
    } catch (error) {
        logger.warn("network.fallback.failed", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

/**
 * Create a fetch implementation bound to the configured proxy and connect
 * tuning.
 *
 * @param bodyTimeoutMs - Maximum idle time between body chunks; long streaming
 * responses need this raised beyond the undici default.
 */
export function createNetworkFetch(bodyTimeoutMs: number): typeof fetch {
    const undici = loadUndici();
    if (!undici) {
        applyHostNetFallback();
        return fetch;
    }
    const doFetch = undici.fetch as unknown as (
        input: string,
        init?: RequestInit & { dispatcher?: Undici.Dispatcher }
    ) => Promise<Response>;
    const networkFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const targetUrl = requestUrlOf(input);
        if (!targetUrl) {
            return doFetch(input as string, init);
        }
        return doFetch(targetUrl, { ...init, dispatcher: pickDispatcher(undici, bodyTimeoutMs, targetUrl) });
    };
    return networkFetch as unknown as typeof fetch;
}

/** Create a fetch bound to the configured `opencodego.requestTimeout`. */
export function createConfiguredNetworkFetch(): typeof fetch {
    const requestTimeoutMs = vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<number>(REQUEST_TIMEOUT_KEY, DEFAULT_REQUEST_TIMEOUT_MS);
    return createNetworkFetch(requestTimeoutMs);
}

/**
 * Wire the transport into the extension lifecycle: log the resolved setup and
 * rebuild dispatchers when the transport settings change.
 */
export function initNetwork(context: vscode.ExtensionContext): void {
    const settings = readNetworkSettings();
    logger.info("network.init", {
        undici: undiciVersion(),
        proxy: settings.proxyUrl ? "configured" : "direct",
        autoSelectFamily: settings.connect.autoSelectFamily,
        autoSelectFamilyAttemptTimeout: settings.connect.autoSelectFamilyAttemptTimeout,
    });
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (!NETWORK_CONFIG_KEYS.some((key) => event.affectsConfiguration(key))) {
                return;
            }
            disposeDispatchers("configuration");
            const next = readNetworkSettings();
            logger.info("network.config.changed", {
                proxy: next.proxyUrl ? "configured" : "direct",
                autoSelectFamily: next.connect.autoSelectFamily,
                autoSelectFamilyAttemptTimeout: next.connect.autoSelectFamilyAttemptTimeout,
            });
        }),
        new vscode.Disposable(() => disposeDispatchers("deactivate"))
    );
}
