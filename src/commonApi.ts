import * as vscode from "vscode";
import {
    ProvideLanguageModelChatResponseOptions,
    LanguageModelChatRequestMessage,
    LanguageModelToolCallPart,
    LanguageModelResponsePart2,
    LanguageModelThinkingPart,
    Progress,
    CancellationToken,
} from "vscode";
import { OpenCodeGoModelItem } from "./types";
import { tryParseJSONObject } from "./utils";

/**
 * Token usage information extracted from streaming response usage chunk.
 */
export interface StreamUsage {
    promptTokens: number;
    completionTokens: number;
    cacheHitTokens?: number;
    cacheMissTokens?: number;
}

export abstract class CommonApi<TMessage, TRequestBody> {
    /** Buffer for assembling streamed tool calls by index. */
    protected _toolCallBuffers: Map<number, { id?: string; name?: string; args: string }> = new Map<
        number,
        { id?: string; name?: string; args: string }
    >();

    /** Indices for which a tool call has been fully emitted. */
    protected _completedToolCallIndices = new Set<number>();

    /** Track if we emitted any assistant text before seeing tool calls (SSE-like begin-tool-calls hint). */
    protected _hasEmittedAssistantText = false;

    /** Track if we emitted any text. */
    protected _hasEmittedText = false;

    /** Track if we emitted any thinking text. */
    protected _hasEmittedThinking = false;

    /** Track if we emitted the begin-tool-calls whitespace flush. */
    protected _emittedBeginToolCallsHint = false;

    // XML think block parsing state
    protected _xmlThinkActive = false;
    protected _xmlThinkDetectionAttempted = false;

    // Thinking content state management
    protected _currentThinkingId: string | null = null;

    /** Buffer for accumulating thinking content before emitting. */
    protected _thinkingBuffer = "";

    /** Timer for delayed flushing of thinking buffer. */
    protected _thinkingFlushTimer: NodeJS.Timeout | null = null;

    /** System prompts to include in requests. */
    protected _systemContent: string | undefined;

    /** Set the model ID for logging purposes. */
    protected _modelId = "";

    /** Callback for streaming usage updates (prompt/completion/cache tokens). */
    public _onUsage: ((usage: StreamUsage) => void) | undefined;

    public set onUsage(callback: ((usage: StreamUsage) => void) | undefined) {
        this._onUsage = callback;
    }

    constructor(modelId: string) {
        this._modelId = modelId;
    }

    /**
     * Convert VS Code chat messages to specific api message format.
     * @param messages The VS Code chat messages to convert.
     * @param modelConfig Config for special model.
     * @returns Specific api messages array.
     */
    abstract convertMessages(
        messages: readonly LanguageModelChatRequestMessage[],
        modelConfig: { includeReasoningInRequest: boolean }
    ): TMessage[];

    /**
     * Construct request body for Specific api
     * @param rb Specific api Request body
     * @param um Current Model Info
     * @param options From VS Code
     */
    abstract prepareRequestBody(
        rb: TRequestBody,
        um: OpenCodeGoModelItem | undefined,
        options?: ProvideLanguageModelChatResponseOptions
    ): TRequestBody;

    /**
     * Process specific api streaming response (JSON lines format).
     * @param responseBody The readable stream body.
     * @param progress Progress reporter for streamed parts.
     * @param token Cancellation token.
     */
    abstract processStreamingResponse(
        responseBody: ReadableStream<Uint8Array>,
        progress: Progress<LanguageModelResponsePart2>,
        token: CancellationToken
    ): Promise<void>;

    /**
     * Try to emit a buffered tool call when a valid name and JSON arguments are available.
     * @param index The tool call index from the stream.
     * @param progress Progress reporter for parts.
     */
    protected async tryEmitBufferedToolCall(
        index: number,
        progress: Progress<LanguageModelResponsePart2>
    ): Promise<void> {
        const buf = this._toolCallBuffers.get(index);
        if (!buf) {
            return;
        }
        if (!buf.name) {
            return;
        }
        const canParse = tryParseJSONObject(buf.args);
        if (!canParse.ok) {
            return;
        }
        const id = buf.id ?? `call_${Math.random().toString(36).slice(2, 10)}`;
        let parameters = canParse.value;
        parameters = this.adjustReadFileParameters(buf.name, parameters);
        progress.report(new LanguageModelToolCallPart(id, buf.name, parameters));
        this._toolCallBuffers.delete(index);
        this._completedToolCallIndices.add(index);
    }

    /**
     * Flush all buffered tool calls, optionally throwing if arguments are not valid JSON.
     * @param progress Progress reporter for parts.
     * @param throwOnInvalid If true, throw when a tool call has invalid JSON args.
     */
    protected async flushToolCallBuffers(
        progress: Progress<LanguageModelResponsePart2>,
        throwOnInvalid: boolean
    ): Promise<void> {
        if (this._toolCallBuffers.size === 0) {
            return;
        }
        for (const [idx, buf] of Array.from(this._toolCallBuffers.entries())) {
            const argsText = buf.args.trim() || "{}";
            const parsed = tryParseJSONObject(argsText);
            if (!parsed.ok) {
                if (throwOnInvalid) {
                    console.error("[OpenCodeGo] Invalid JSON for tool call", {
                        idx,
                        snippet: (buf.args || "").slice(0, 200),
                    });
                    throw new Error("Invalid JSON for tool call");
                }
                continue;
            }
            const id = buf.id ?? `call_${Math.random().toString(36).slice(2, 10)}`;
            const name = buf.name ?? "unknown_tool";
            let parameters = parsed.value;
            parameters = this.adjustReadFileParameters(name, parameters);
            progress.report(new LanguageModelToolCallPart(id, name, parameters));
            this._toolCallBuffers.delete(idx);
            this._completedToolCallIndices.add(idx);
        }
    }

    /**
     * Adjust read_file tool parameters to default to reading configurable number of lines.
     * @param toolName The name of the tool being called.
     * @param parameters The tool parameters.
     * @returns Adjusted parameters.
     */
    protected adjustReadFileParameters(toolName: string, parameters: Record<string, unknown>): Record<string, unknown> {
        if (toolName !== "read_file") {
            return parameters;
        }
        const config = vscode.workspace.getConfiguration();
        const defaultLines = config.get<number>("opencodego.readFileLines", 0);
        if (defaultLines <= 0) {
            return parameters;
        }

        const startLine = typeof parameters.startLine === "number" ? parameters.startLine : 1;
        const endLine = typeof parameters.endLine === "number" ? parameters.endLine : startLine;
        if (endLine < startLine + defaultLines) {
            return { ...parameters, endLine: startLine + defaultLines };
        }
        return parameters;
    }

    /**
     * Report to VS Code for ending thinking
     * @param progress Progress reporter for parts
     */
    protected reportEndThinking(progress: Progress<LanguageModelResponsePart2>) {
        if (!this._currentThinkingId) {
            return;
        }
        try {
            this.flushThinkingBuffer(progress);
            progress.report(new LanguageModelThinkingPart("", this._currentThinkingId));
        } catch (e) {
            console.error("[OpenCodeGo] Failed to end thinking sequence:", e);
        }
        this._currentThinkingId = null;
        this._thinkingBuffer = "";
        if (this._thinkingFlushTimer) {
            clearTimeout(this._thinkingFlushTimer);
            this._thinkingFlushTimer = null;
        }
    }

    /**
     * Generate a unique thinking ID based on request start time and random suffix
     */
    protected generateThinkingId(): string {
        return `thinking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    /**
     * Buffer and schedule a flush for thinking content.
     * @param text The thinking text to buffer
     * @param progress Progress reporter for parts
     */
    protected bufferThinkingContent(text: string, progress: Progress<LanguageModelResponsePart2>): void {
        this._hasEmittedThinking = true;
        if (!this._currentThinkingId) {
            this._currentThinkingId = this.generateThinkingId();
        }

        this._thinkingBuffer += text;

        if (!this._thinkingFlushTimer) {
            this._thinkingFlushTimer = setTimeout(() => {
                this.flushThinkingBuffer(progress);
            }, 100);
        }
    }

    /**
     * Flush the thinking buffer to the progress reporter.
     * @param progress Progress reporter for parts.
     */
    protected flushThinkingBuffer(progress: Progress<LanguageModelResponsePart2>): void {
        if (this._thinkingFlushTimer) {
            clearTimeout(this._thinkingFlushTimer);
            this._thinkingFlushTimer = null;
        }

        if (this._thinkingBuffer && this._currentThinkingId) {
            const text = this._thinkingBuffer;
            this._thinkingBuffer = "";
            progress.report(new LanguageModelThinkingPart(text, this._currentThinkingId));
        }
    }

    /**
     * Process XML think blocks in text content.
     * @param content The text content to process.
     * @param progress Progress reporter for parts.
     * @returns Object indicating whether any think blocks were emitted.
     */
    protected processXmlThinkBlocks(
        content: string,
        progress: Progress<LanguageModelResponsePart2>
    ): { emittedAny: boolean } {
        if (!content.includes("꽁") && !content.includes("ground") && !this._xmlThinkActive) {
            return { emittedAny: false };
        }

        this._xmlThinkDetectionAttempted = true;
        let remaining = content;
        let emittedAny = false;

        while (remaining.length > 0) {
            if (this._xmlThinkActive) {
                const endIdx = remaining.indexOf("꽁");
                if (endIdx === -1) {
                    this.bufferThinkingContent(remaining, progress);
                    emittedAny = true;
                    break;
                } else {
                    const thinkText = remaining.slice(0, endIdx);
                    if (thinkText) {
                        this.bufferThinkingContent(thinkText, progress);
                        emittedAny = true;
                    }
                    this.reportEndThinking(progress);
                    this._xmlThinkActive = false;
                    remaining = remaining.slice(endIdx + 8);
                }
            } else {
                const startIdx = remaining.indexOf("꽁");
                if (startIdx === -1) {
                    if (!emittedAny) {
                        return { emittedAny: false };
                    }
                    // Emit remaining text after think block
                    this.reportEndThinking(progress);
                    if (remaining.trim()) {
                        progress.report(new vscode.LanguageModelTextPart(remaining));
                    }
                    break;
                } else {
                    // Emit text before 꽁 tag
                    const beforeThink = remaining.slice(0, startIdx);
                    if (beforeThink.trim()) {
                        this.reportEndThinking(progress);
                        progress.report(new vscode.LanguageModelTextPart(beforeThink));
                    }
                    this._xmlThinkActive = true;
                    remaining = remaining.slice(startIdx + 7);
                }
            }
        }

        return { emittedAny };
    }

    /**
     * Process regular text content (non-XML-think).
     * @param content Text content to process.
     * @param progress Progress reporter for parts.
     * @returns Object indicating whether any text was emitted.
     */
    protected processTextContent(
        content: string,
        progress: Progress<LanguageModelResponsePart2>
    ): { emittedAny: boolean } {
        if (!content) {
            return { emittedAny: false };
        }
        progress.report(new vscode.LanguageModelTextPart(content));
        return { emittedAny: true };
    }

    /**
     * Prepare headers for API request.
     * @param apiKey The API key to use.
     * @param apiMode The apiMode (affects header format).
     * @param customHeaders Optional custom headers from model config.
     * @returns Headers object.
     */
    public static prepareHeaders(
        apiKey: string,
        apiMode: string,
        customHeaders?: Record<string, string>
    ): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "ai-sdk/openai-compatible/2.0.41 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.11",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
        };

        // Provider-specific header formats
        if (apiMode === "anthropic") {
            headers["x-api-key"] = apiKey;
            headers["anthropic-version"] = "2023-06-01";
        } else {
            // OpenAI-compatible API uses Bearer auth
            headers["Authorization"] = `Bearer ${apiKey}`;
        }

        // Merge custom headers if provided
        if (customHeaders) {
            for (const [key, value] of Object.entries(customHeaders)) {
                headers[key] = value;
            }
        }

        return headers;
    }
}
