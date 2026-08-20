import * as vscode from "vscode";
import type { OpenCodeGoModelItem, RetryConfig } from "./types";
import type { StoredImage } from "./vision/types";
import { OpenAIFunctionToolDef } from "./openai/openaiTypes";
import type { ResponsesFunctionToolDef } from "./openai/responsesTypes";
import { CancellationToken } from "vscode";

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

/** Convert an OpenAI Chat function definition to the flat Responses format. */
export function convertOpenAIToolToResponses(tool: OpenAIFunctionToolDef): ResponsesFunctionToolDef {
    return {
        type: "function",
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters ?? { type: "object", properties: {} },
        // VS Code tool schemas are not guaranteed to satisfy OpenAI strict-mode
        // requirements (all properties required, additionalProperties=false).
        strict: false,
    };
}

/** Convert VS Code tool definitions to the flat OpenAI Responses format. */
export function convertToolsToResponses(
    options?: vscode.ProvideLanguageModelChatResponseOptions
): { tools?: ResponsesFunctionToolDef[]; tool_choice?: string } {
    const chatTools = convertToolsToOpenAI(options);
    return {
        tools: chatTools.tools?.map(convertOpenAIToolToResponses),
        tool_choice: chatTools.tool_choice,
    };
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
 * VS Code MIME type for MCP tool result resource links.
 * The data is a JSON string: { "uri": string, "underlyingMimeType"?: string }.
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/mcp/common/mcpTypes.ts
 */
export const RESOURCE_LINK_MIME = "application/vnd.code.resource-link";

/**
 * Check if a mime type is an MCP resource-link data part.
 */
export function isResourceLinkMimeType(mimeType: string): boolean {
    return mimeType === RESOURCE_LINK_MIME;
}

/**
 * Parsed contents of an MCP resource-link data part.
 */
export interface ParsedResourceLink {
    uri: string;
    underlyingMimeType?: string;
}

/**
 * Parse the JSON payload of an MCP resource-link data part.
 * Returns null when the payload is not a valid resource link.
 */
export function parseResourceLinkData(data: Uint8Array): ParsedResourceLink | null {
    try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(data));
        if (parsed && typeof parsed === "object" && typeof (parsed as { uri?: unknown }).uri === "string") {
            const uri = (parsed as { uri: string }).uri;
            const underlying = (parsed as { underlyingMimeType?: unknown }).underlyingMimeType;
            return {
                uri,
                ...(typeof underlying === "string" ? { underlyingMimeType: underlying } : {}),
            };
        }
    } catch {
        // ignore malformed payloads
    }
    return null;
}

const RESOURCE_LINK_EXT_MIME: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
};

/**
 * Guess an image MIME type from a resource URI path extension.
 */
export function guessImageMimeTypeFromUri(uri: string): string | undefined {
    try {
        const pathname = vscode.Uri.parse(uri).path.toLowerCase();
        const ext = pathname.slice(pathname.lastIndexOf("."));
        return RESOURCE_LINK_EXT_MIME[ext];
    } catch {
        return undefined;
    }
}

/**
 * Resolve an MCP resource-link data part to actual image bytes when possible.
 * VS Code registers a file system provider for `vscode-chat-response-resource://`
 * URIs, so images can be read back while the chat session is alive.
 * Returns null when the link is not an image or cannot be read.
 */
export async function resolveResourceLinkToImage(
    data: Uint8Array
): Promise<{ data: Uint8Array; mimeType: string } | null> {
    const link = parseResourceLinkData(data);
    if (!link) {
        return null;
    }

    const mimeType = link.underlyingMimeType || guessImageMimeTypeFromUri(link.uri);
    if (!mimeType || !isImageMimeType(mimeType)) {
        return null;
    }

    try {
        const uri = vscode.Uri.parse(link.uri);
        const bytes = await vscode.workspace.fs.readFile(uri);
        if (!bytes || bytes.length === 0) {
            return null;
        }
        return { data: bytes, mimeType };
    } catch {
        // Resource may be gone (session disposed) or scheme not readable.
        return null;
    }
}

/**
 * Regex pattern to match data URI encoded images in text.
 * Matches: data:image/{format};base64,{base64_data}
 */
const DATA_URI_IMAGE_RE = /data:image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,([A-Za-z0-9+/=]+)/g;

/**
 * Detect base64-encoded data URI images in text, decode and store them.
 * Used during the image storage pass in convertMessages.
 * @returns The number of data URI images found and stored.
 */
export function storeDataUriImages(text: string, imagesToStore: StoredImage[]): number {
    let count = 0;
    DATA_URI_IMAGE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DATA_URI_IMAGE_RE.exec(text)) !== null) {
        const fullMatch = match[0];
        const base64Data = match[1];
        count++;

        let mimeType = "image/png";
        if (fullMatch.startsWith("data:image/jpeg")) mimeType = "image/jpeg";
        else if (fullMatch.startsWith("data:image/gif")) mimeType = "image/gif";
        else if (fullMatch.startsWith("data:image/webp")) mimeType = "image/webp";
        else if (fullMatch.startsWith("data:image/bmp")) mimeType = "image/bmp";

        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        imagesToStore.push({ data: bytes, mimeType });
    }
    return count;
}

/**
 * Replace base64-encoded data URI images in text with image index references.
 * Does NOT store images (they should already be stored by the storage pass).
 * @param text The text to scan.
 * @param startIndex The starting imageIndex to assign.
 * @returns { text: string; count: number } The modified text and number of replacements.
 */
export function replaceDataUriImages(text: string, startIndex: number): { text: string; count: number } {
    let result = text;
    let offset = 0;
    let count = 0;
    let idx = startIndex;

    DATA_URI_IMAGE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DATA_URI_IMAGE_RE.exec(text)) !== null) {
        const fullMatch = match[0];
        count++;
        const before = result.slice(0, match.index + offset);
        const after = result.slice(match.index + offset + fullMatch.length);
        const replacement = `\n[Image data from tool call (imageIndex=${idx}). I am a text-only model and CANNOT see images directly. I MUST call the ask_image tool to learn about it.\n\nRecommended strategy:\n1. First call ask_image for a brief description to get an overview of the image.\n2. Then call ask_image again with specific questions about details you need (e.g., colors, text content, UI elements, error messages, or any other visible information).\n]`;
        result = before + replacement + after;
        offset += replacement.length - fullMatch.length;
        idx++;
    }

    return { text: result, count };
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


export function delay(ms: number, token?: CancellationToken): Promise<void> {
    return new Promise((resolve) => {
        if (token?.isCancellationRequested) {
            return resolve();
        }
        const timer = setTimeout(() => {
            disposable?.dispose();
            resolve();
        }, ms);
        const disposable = token?.onCancellationRequested(() => {
            clearTimeout(timer);
            resolve();
        });
    });
}
