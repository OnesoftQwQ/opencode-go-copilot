import * as crypto from "crypto";
import * as vscode from "vscode";
import type { LanguageModelChatRequestMessage } from "vscode";
import { logger } from "./logger";

/**
 * Session ID registry for the `x-opencode-session` header.
 *
 * OpenCode Go requires a stable per-conversation session ID on every inference
 * request (server-side session affinity for routing and prompt-cache
 * optimization) and errors without it since 2026-09-05. VS Code exposes no
 * conversation identity to language model providers, and the first request of
 * a conversation contains nothing unique enough to derive a collision-free ID
 * from. Strategy:
 *
 * 1. First turn: send a random UUID. Once the turn completes, register
 *    `hash(model + first user text + first assistant text) → UUID`. Chat
 *    clients re-send the full history on every later turn, so the assistant
 *    output — unique in practice — is part of every subsequent request and
 *    serves as the registry key. Registration always keys on what the NEXT
 *    turn's lookup will extract from its re-sent history: the history's first
 *    assistant message when one exists (registry-miss rebuild after a
 *    restart or LRU eviction), otherwise this turn's output (which becomes
 *    that first assistant message next turn).
 * 2. Later turns: resolve the ID from the registry using the same key
 *    extracted from the re-sent history. Stable across turns of one
 *    conversation, distinct across conversations that share an opening
 *    message.
 * 3. Upstream-provider failures: session affinity can pin a conversation to a
 *    broken backend (#123). `rotateSessionId()` re-registers a fresh UUID so
 *    in-request retries and later turns escape it.
 *
 * The registry persists in extension globalState with a sliding 3-day TTL
 * (entries unused for 3 days expire), so restarting VS Code keeps
 * conversation affinity.
 */

/** Upper bound on remembered sessions; insertion-order LRU eviction. */
const MAX_SESSION_ENTRIES = 512;

/** Sessions unused for longer than this are considered expired (sliding TTL). */
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** globalState key holding the serialized registry across restarts. */
const STORAGE_KEY = "opencodego.sessionRouting.v1";

/** One remembered conversation: its session ID and when it was last used. */
interface StoredSessionEntry {
    sessionId: string;
    /** Epoch ms of the last resolve/registration, drives the TTL. */
    lastUsedAt: number;
}

/** Conversation anchor (sha256 hex) → session entry. */
const _sessions = new Map<string, StoredSessionEntry>();

/** Persistence backend (extension globalState), set during activation. */
let _storage: vscode.Memento | undefined;

/**
 * Restore the registry from extension globalState. Must be called during
 * activation, before any request can resolve a session ID. Entries unused for
 * more than the 3-day TTL are dropped on load.
 *
 * @param storage The extension's globalState memento.
 */
export function initSessionRouting(storage: vscode.Memento): void {
    _storage = storage;
    const stored = storage.get<Record<string, StoredSessionEntry>>(STORAGE_KEY, {});
    const now = Date.now();
    let restored = 0;
    let expired = 0;
    for (const [anchor, entry] of Object.entries(stored ?? {})) {
        if (!entry || typeof entry.sessionId !== "string" || typeof entry.lastUsedAt !== "number") {
            continue;
        }
        if (now - entry.lastUsedAt > SESSION_TTL_MS) {
            expired++;
            continue;
        }
        _sessions.set(anchor, entry);
        restored++;
    }
    logger.info("sessionRouting.init", { restored, expired });
}

/**
 * Serialize the registry to globalState. Fire-and-forget: a lost write only
 * costs one registry miss (a fresh UUID) later.
 */
function persist(): void {
    if (!_storage) {
        return;
    }
    const snapshot: Record<string, StoredSessionEntry> = {};
    for (const [anchor, entry] of _sessions) {
        snapshot[anchor] = entry;
    }
    void Promise.resolve(_storage.update(STORAGE_KEY, snapshot)).catch(() => { });
}

/** Result of resolving a session ID for an outgoing request. */
export interface SessionResolution {
    /** The session ID to send. */
    sessionId: string;
    /** True when sessionId came from the registry (stable across turns). */
    registered: boolean;
}

/**
 * Concatenate the text content of a message, ignoring binary data parts and
 * tool call parts so the anchor stays cheap and deterministic.
 */
function extractText(content: ReadonlyArray<unknown>): string {
    let text = "";
    for (const part of content) {
        if (typeof part === "string") {
            text += part;
        } else if (part instanceof vscode.LanguageModelTextPart) {
            text += part.value;
        }
    }
    return text;
}

/**
 * First non-blank user message text in the history, or null when absent.
 */
function firstUserText(messages: readonly LanguageModelChatRequestMessage[]): string | null {
    for (const message of messages) {
        if (message.role !== vscode.LanguageModelChatMessageRole.User) {
            continue;
        }
        const text = extractText(message.content);
        if (text.trim()) {
            return text;
        }
    }
    return null;
}

/**
 * First assistant message text in the re-sent history, or null when the
 * conversation has no assistant turn yet (first request).
 */
function firstAssistantText(messages: readonly LanguageModelChatRequestMessage[]): string | null {
    for (const message of messages) {
        if (message.role === vscode.LanguageModelChatMessageRole.Assistant) {
            return extractText(message.content);
        }
    }
    return null;
}

/**
 * Hash the conversation anchor: model ID + first user text + assistant text.
 */
function anchorHash(modelId: string, userText: string, assistantText: string): string {
    const hash = crypto.createHash("sha256");
    hash.update(modelId);
    hash.update("\u0000");
    hash.update(userText);
    hash.update("\u0000");
    hash.update(assistantText);
    return hash.digest("hex");
}

/**
 * Store a session ID under an anchor, refreshing LRU position and the TTL
 * timestamp, evicting the oldest entries beyond the cap, and persisting.
 */
function store(anchor: string, sessionId: string): void {
    _sessions.delete(anchor);
    _sessions.set(anchor, { sessionId, lastUsedAt: Date.now() });
    while (_sessions.size > MAX_SESSION_ENTRIES) {
        const oldest = _sessions.keys().next().value;
        if (oldest === undefined) {
            break;
        }
        _sessions.delete(oldest);
    }
    persist();
}

/**
 * Resolve the session ID for an outgoing chat request. When the re-sent
 * history already identifies a registered conversation (any turn after the
 * first), its ID is reused; otherwise a fresh random UUID is returned and the
 * caller should register it once the turn's assistant output is complete.
 *
 * @param modelId The model ID the request targets (keeps sessions distinct per model).
 * @param messages The request messages from VS Code.
 * @returns The session ID to send and whether it came from the registry.
 */
export function resolveSessionId(
    modelId: string,
    messages: readonly LanguageModelChatRequestMessage[]
): SessionResolution {
    const userText = firstUserText(messages);
    if (userText === null) {
        return { sessionId: crypto.randomUUID(), registered: false };
    }
    const assistantText = firstAssistantText(messages);
    if (assistantText === null) {
        return { sessionId: crypto.randomUUID(), registered: false };
    }
    const anchor = anchorHash(modelId, userText, assistantText);
    const existing = _sessions.get(anchor);
    if (existing) {
        if (Date.now() - existing.lastUsedAt > SESSION_TTL_MS) {
            // Slid past the TTL while the window stayed open — treat as miss.
            _sessions.delete(anchor);
            persist();
            return { sessionId: crypto.randomUUID(), registered: false };
        }
        store(anchor, existing.sessionId);
        return { sessionId: existing.sessionId, registered: true };
    }
    return { sessionId: crypto.randomUUID(), registered: false };
}

/**
 * Register the session ID used by a turn under the anchor that
 * `resolveSessionId()` will look up on the NEXT turn: `hash(model + first
 * user text + first assistant text of that turn's re-sent history)`. When
 * this turn already carries assistant history (registry miss after a restart
 * or LRU eviction), that first assistant message is in the current history;
 * on the first turn it is this turn's output, which becomes the first
 * assistant message next turn.
 *
 * @param modelId The model ID the request targeted.
 * @param messages The request messages from VS Code.
 * @param turnOutput The assistant output collected during this turn.
 * @param sessionId The session ID that was sent for this turn.
 */
export function registerSessionId(
    modelId: string,
    messages: readonly LanguageModelChatRequestMessage[],
    turnOutput: string,
    sessionId: string
): void {
    const userText = firstUserText(messages);
    if (userText === null) {
        return;
    }
    const assistantText = firstAssistantText(messages) ?? turnOutput;
    store(anchorHash(modelId, userText, assistantText), sessionId);
}

/**
 * Rotate the session ID after an upstream-provider failure so retries and
 * later turns are routed away from the broken backend. Re-registers the new
 * ID when the conversation is already identifiable from the history; on the
 * first turn (no assistant output yet) the caller's end-of-turn registration
 * persists the final ID instead.
 *
 * @param modelId The model ID the request targets.
 * @param messages The request messages from VS Code.
 * @returns A fresh session ID for the retry.
 */
export function rotateSessionId(
    modelId: string,
    messages: readonly LanguageModelChatRequestMessage[]
): string {
    const newId = crypto.randomUUID();
    const userText = firstUserText(messages);
    const assistantText = firstAssistantText(messages);
    if (userText !== null && assistantText !== null) {
        store(anchorHash(modelId, userText, assistantText), newId);
    }
    return newId;
}

/**
 * Clear all registered session IDs. The next request of every conversation
 * gets a fresh UUID — an escape hatch for users pinned to a degraded backend
 * (#123) without editing their opening message.
 *
 * @returns The number of registrations that were cleared.
 */
export function resetSessionRouting(): number {
    const cleared = _sessions.size;
    _sessions.clear();
    persist();
    return cleared;
}

/**
 * Detect upstream-provider failures thrown as API errors by the provider
 * request paths: the observed signature is HTTP 400 with `api_error` /
 * "Upstream request failed" / "Upstream response was not valid JSON" bodies
 * (#123), plus any 5xx. Auth (401), rate limits (429) and moderation
 * rejections never match, so they keep their existing handling.
 *
 * @param err The error thrown from a request dispatch.
 * @returns True when the error is plausibly a broken backend worth a session-ID rotation.
 */
export function isUpstreamProviderFailureError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    const statusMatch = message.match(/\[(\d{3})\]/);
    if (!statusMatch) {
        return false;
    }
    const status = Number(statusMatch[1]);
    if (status >= 500) {
        return true;
    }
    if (status !== 400) {
        return false;
    }
    const lower = message.toLowerCase();
    return lower.includes("api_error") && (lower.includes("upstream") || lower.includes("error from provider"));
}
