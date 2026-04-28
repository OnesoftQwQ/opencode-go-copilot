import * as vscode from "vscode";
import type { OpenCodeGoModelItem, RetryConfig } from "./types";
import { OpenAIFunctionToolDef } from "./openai/openaiTypes";

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 1000;
const RETRY_BACKOFF_FACTOR = 2;
const RETRY_MAX_INTERVAL_MS = 60000;

// HTTP status codes that should trigger a retry
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Network error patterns to retry
const networkErrorPatterns = [
    "fetch failed",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "timeout",
    "TIMEOUT",
    "network error",
    "NetworkError",
];

// Model ID parsing helper
export interface ParsedModelId {
    baseId: string;
    configId?: string;
}

export function getModelProviderId(model: unknown): string {
    if (!model || typeof model !== "object") {
        return "";
    }
    const obj = model as Record<string, unknown>;
    const pick = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    return (
        pick(obj.owned_by) ||
        pick(obj.provide) ||
        pick(obj.provider) ||
        pick(obj.ownedBy) ||
        pick(obj.owner) ||
        pick(obj.vendor)
    );
}

export function normalizeUserModels(models: unknown): OpenCodeGoModelItem[] {
    const list = Array.isArray(models) ? models : [];
    const out: OpenCodeGoModelItem[] = [];
    for (const item of list) {
        if (!item || typeof item !== "object") {
            continue;
        }
        const provider = getModelProviderId(item);
        out.push({ ...(item as OpenCodeGoModelItem), owned_by: provider });
    }
    return out;
}

/**
 * Parse a model ID that may contain a configuration ID separator.
 * Format: "baseId::configId" or just "baseId"
 */
export function parseModelId(modelId: string): ParsedModelId {
    const parts = modelId.split("::");
    if (parts.length >= 2) {
        return {
            baseId: parts[0],
            configId: parts.slice(1).join("::"),
        };
    }
    return {
        baseId: modelId,
    };
}

/**
 * Map VS Code message role to OpenAI message role string.
 */
export function mapRole(message: vscode.LanguageModelChatRequestMessage): "user" | "assistant" | "system" {
    const USER = vscode.LanguageModelChatMessageRole.User as unknown as number;
    const ASSISTANT = vscode.LanguageModelChatMessageRole.Assistant as unknown as number;
    const r = message.role as unknown as number;
    if (r === USER) {
        return "user";
    }
    if (r === ASSISTANT) {
        return "assistant";
    }
    return "system";
}

/**
 * Convert VS Code tool definitions to OpenAI function tool definitions.
 */
export function convertToolsToOpenAI(
    options?: vscode.ProvideLanguageModelChatResponseOptions
): { tools?: OpenAIFunctionToolDef[]; tool_choice?: string } {
    if (!options?.tools || options.tools.length === 0) {
        return {};
    }

    const tools: OpenAIFunctionToolDef[] = options.tools.map((tool) => {
        const def: OpenAIFunctionToolDef = {
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
            },
        };
        // Use the tool's inputSchema as parameters if available
        if (tool.inputSchema) {
            def.function.parameters = tool.inputSchema;
        } else {
            def.function.parameters = { type: "object", properties: {} };
        }
        return def;
    });

    // Determine tool_choice mode
    const toolMode = (options?.modelOptions as Record<string, unknown> | undefined)
        ?.toolMode as string | undefined;

    let toolChoice: string | undefined;
    if (toolMode === "required") {
        toolChoice = "required";
    } else if (toolMode === "none") {
        toolChoice = "none";
    } else if (toolMode === "auto") {
        toolChoice = "auto";
    }

    return { tools, tool_choice: toolChoice };
}

/**
 * Create retry configuration from VS Code settings.
 */
export function createRetryConfig(): RetryConfig {
    const config = vscode.workspace.getConfiguration("opencodego.retry");
    const enabled = config.get<boolean>("enabled", true);
    const maxAttempts = config.get<number>("max_attempts", RETRY_MAX_ATTEMPTS);
    const intervalMs = config.get<number>("interval_ms", RETRY_INTERVAL_MS);
    const additionalStatusCodes = config.get<number[]>("status_codes", []);

    return {
        enabled,
        maxAttempts,
        intervalMs,
        backoffFactor: RETRY_BACKOFF_FACTOR,
        maxIntervalMs: RETRY_MAX_INTERVAL_MS,
        statusCodes: [...RETRYABLE_STATUS_CODES, ...additionalStatusCodes],
    };
}

/**
 * Execute an async function with retry logic.
 */
export async function executeWithRetry<T>(
    fn: () => Promise<T>,
    retryConfig: RetryConfig
): Promise<T> {
    if (!retryConfig.enabled) {
        return fn();
    }

    let lastError: Error | undefined;
    let delay = retryConfig.intervalMs;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            if (attempt === retryConfig.maxAttempts) {
                break;
            }

            // Check if error is retryable
            const isRetryable = isRetryableError(lastError, retryConfig.statusCodes);
            if (!isRetryable) {
                break;
            }

            // Wait before retrying
            await new Promise<void>((resolve) => setTimeout(resolve, delay));

            // Exponential backoff
            delay = Math.min(delay * retryConfig.backoffFactor, retryConfig.maxIntervalMs);
        }
    }

    throw lastError;
}

function isRetryableError(error: Error, retryableStatusCodes: number[]): boolean {
    const message = error.message.toLowerCase();

    // Check network error patterns
    for (const pattern of networkErrorPatterns) {
        if (message.includes(pattern.toLowerCase())) {
            return true;
        }
    }

    // Check HTTP status codes in error message
    for (const code of retryableStatusCodes) {
        if (message.includes(`[${code}]`) || message.includes(`status ${code}`)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a mime type is an image type.
 */
export function isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith("image/");
}

/**
 * Create a data URL from a LanguageModelDataPart.
 */
export function createDataUrl(part: vscode.LanguageModelDataPart): string {
    const base64 = arrayBufferToBase64(part.data);
    return `data:${part.mimeType};base64,${base64}`;
}

function arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Check if a part is a tool result part.
 */
export function isToolResultPart(
    part: unknown
): part is vscode.LanguageModelToolResultPart {
    return part instanceof vscode.LanguageModelToolResultPart;
}

/**
 * Collect text content from a tool result part.
 */
export function collectToolResultText(part: {
    content?: ReadonlyArray<unknown>;
}): string {
    if (!part.content) {
        return "";
    }
    const texts: string[] = [];
    for (const item of part.content) {
        if (item instanceof vscode.LanguageModelTextPart) {
            texts.push(item.value);
        }
    }
    return texts.join("\n").trim();
}

/**
 * Safely try to parse a JSON object from a string.
 * Returns { ok: true, value } or { ok: false }.
 */
export function tryParseJSONObject(
    text: string
): { ok: true; value: Record<string, unknown> } | { ok: false } {
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return { ok: true, value: parsed as Record<string, unknown> };
        }
        return { ok: false };
    } catch {
        return { ok: false };
    }
}
