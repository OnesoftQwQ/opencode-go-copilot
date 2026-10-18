import * as vscode from "vscode";
import {
    CancellationToken,
    LanguageModelChatRequestMessage,
    LanguageModelResponsePart,
    ProvideLanguageModelChatResponseOptions,
    Progress,
} from "vscode";

import type { OpenCodeGoModelItem } from "../types";
import { CommonApi, StreamUsage } from "../commonApi";
import { logger } from "../logger";
import type { StoredImage } from "../vision/types";
import {
    ASK_IMAGE_TOOL_DEF,
    ASK_IMAGE_TOOL_NAME,
    ASK_WITH_MULTI_IMAGE_TOOL_DEF,
    ASK_WITH_MULTI_IMAGE_TOOL_NAME,
} from "../vision/types";
import { parseVisionToolHistoryPart } from "../vision/historyPart";
import { toGoogleVisionToolMessages, type VisionToolHistoryEntry } from "../vision/historyCodec";
import {
    convertToolsToOpenAI,
    isImageMimeType,
    isResourceLinkMimeType,
    isToolResultPart,
    mapRole,
    parseResourceLinkData,
    replaceDataUriImages,
    resolveResourceLinkToImage,
    storeDataUriImages,
} from "../utils";
import {
    SKIP_THOUGHT_SIGNATURE_VALIDATOR,
    type GoogleContent,
    type GoogleFunctionCall,
    type GoogleFunctionDeclaration,
    type GoogleGenerateContentResponse,
    type GoogleGenerationConfig,
    type GooglePart,
    type GoogleRequestBody,
    type GoogleThinkingConfig,
    type GoogleUsageMetadata,
} from "./googleTypes";

/** Text-only directive injected when a non-vision model receives an image. */
function imageReferenceText(imageIndex: number): string {
    return `\n[The user sent an image (imageIndex=${imageIndex}). I am a text-only model and CANNOT see images directly. I MUST call the ask_image tool to learn about it.\n\nRecommended strategy:\n1. First call ask_image for a brief description to get an overview of the image.\n2. Then call ask_image again with specific questions about details you need (e.g., colors, text content, UI elements, error messages, or any other visible information).\n]`;
}

/** Base64-encode raw bytes for Gemini inlineData. */
function toBase64(data: Uint8Array): string {
    return Buffer.from(data).toString("base64");
}

/**
 * Google Gemini generateContent protocol adapter.
 *
 * Unlike the OpenAI-compatible adapters, Gemini has no top-level `messages`
 * array and no `role: "tool"`: tool results are functionResponse parts in a
 * `user` content block, and the system prompt is carried outside the
 * conversation in `systemInstruction`. Thinking parts are text parts flagged
 * with `thought: true`; tool calls arrive as complete functionCall objects
 * (not streamed argument fragments).
 */
export class GoogleApi extends CommonApi<GoogleContent, GoogleRequestBody> {
    /** Whether images were found during convertMessages for the ask_image proxy. */
    private _hasImages = false;

    constructor(modelId: string) {
        super(modelId);
    }

    /**
     * Convert VS Code chat messages into Gemini contents + systemInstruction.
     *
     * Vision models receive inlineData image parts directly. Non-vision models
     * get the same ask_image proxy behaviour as the other adapters: images are
     * stored on the instance and replaced with a directive text part.
     */
    async convertMessages(
        messages: readonly LanguageModelChatRequestMessage[],
        modelConfig: { includeReasoningInRequest: boolean; vision?: boolean }
    ): Promise<GoogleContent[]> {
        const modelSupportsVision = modelConfig.vision !== false;
        const contents: GoogleContent[] = [];
        const systemTexts: string[] = [];
        const toolNameByCallId = new Map<string, string>();
        let imageIndex = 0;

        // Pass 1: collect images for the text-only vision proxy.
        if (!modelSupportsVision) {
            const imagesToStore: StoredImage[] = [];
            for (const m of messages) {
                for (const part of m.content ?? []) {
                    if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
                        imagesToStore.push({ data: part.data, mimeType: part.mimeType });
                    }
                    if (isToolResultPart(part)) {
                        const toolContent = (part as { content?: ReadonlyArray<unknown> }).content;
                        if (toolContent) {
                            for (const inner of toolContent) {
                                if (inner instanceof vscode.LanguageModelDataPart && isImageMimeType(inner.mimeType)) {
                                    imagesToStore.push({ data: inner.data, mimeType: inner.mimeType });
                                } else if (inner instanceof vscode.LanguageModelTextPart) {
                                    storeDataUriImages(inner.value, imagesToStore);
                                } else if (inner instanceof vscode.LanguageModelDataPart && isResourceLinkMimeType(inner.mimeType)) {
                                    const stored = await resolveResourceLinkToImage(inner.data);
                                    if (stored) {
                                        imagesToStore.push(stored);
                                    }
                                }
                            }
                        }
                    }
                    if (part instanceof vscode.LanguageModelTextPart) {
                        storeDataUriImages(part.value, imagesToStore);
                    }
                }
            }
            if (imagesToStore.length > 0) {
                this._localImages = imagesToStore;
                this._hasImages = true;
            }
        }

        for (const m of messages) {
            const role = mapRole(m);
            const textParts: string[] = [];
            const imageParts: vscode.LanguageModelDataPart[] = [];
            const toolCalls: GoogleFunctionCall[] = [];
            const toolResults: Array<{ callId: string; text: string; images: GooglePart[] }> = [];
            const reasoningParts: string[] = [];
            const visionHistory: VisionToolHistoryEntry[] = [];

            for (const part of m.content ?? []) {
                const historyEntry = parseVisionToolHistoryPart(part);
                if (historyEntry) {
                    visionHistory.push(historyEntry);
                } else if (part instanceof vscode.LanguageModelTextPart) {
                    if (modelSupportsVision) {
                        textParts.push(part.value);
                    } else {
                        const result = replaceDataUriImages(part.value, imageIndex);
                        imageIndex += result.count;
                        textParts.push(result.text);
                    }
                } else if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
                    if (modelSupportsVision) {
                        imageParts.push(part);
                    } else {
                        textParts.push(imageReferenceText(imageIndex));
                        imageIndex++;
                    }
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    const id = part.callId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    toolNameByCallId.set(id, part.name);
                    toolCalls.push({
                        id,
                        name: part.name,
                        args: (part.input ?? {}) as Record<string, unknown>,
                    });
                } else if (isToolResultPart(part)) {
                    const callId = (part as { callId?: string }).callId ?? "";
                    const toolContent = (part as { content?: ReadonlyArray<unknown> }).content;
                    const toolTexts: string[] = [];
                    const toolImages: GooglePart[] = [];
                    if (toolContent) {
                        for (const inner of toolContent) {
                            if (inner instanceof vscode.LanguageModelTextPart) {
                                if (modelSupportsVision) {
                                    toolTexts.push(inner.value);
                                } else {
                                    const result = replaceDataUriImages(inner.value, imageIndex);
                                    imageIndex += result.count;
                                    toolTexts.push(result.text);
                                }
                            } else if (inner instanceof vscode.LanguageModelDataPart && isImageMimeType(inner.mimeType)) {
                                if (modelSupportsVision) {
                                    toolImages.push({
                                        inlineData: {
                                            mimeType: inner.mimeType,
                                            data: toBase64(inner.data),
                                        },
                                    });
                                } else {
                                    toolTexts.push(imageReferenceText(imageIndex));
                                    imageIndex++;
                                }
                            } else if (inner instanceof vscode.LanguageModelDataPart && isResourceLinkMimeType(inner.mimeType)) {
                                const stored = await resolveResourceLinkToImage(inner.data);
                                if (stored) {
                                    if (modelSupportsVision) {
                                        toolImages.push({
                                            inlineData: {
                                                mimeType: stored.mimeType,
                                                data: toBase64(stored.data),
                                            },
                                        });
                                    } else {
                                        toolTexts.push(imageReferenceText(imageIndex));
                                        imageIndex++;
                                    }
                                } else {
                                    const link = parseResourceLinkData(inner.data);
                                    if (link) {
                                        toolTexts.push(`\n[Tool returned an unresolvable resource link: ${link.uri}]`);
                                    }
                                }
                            }
                        }
                    }
                    toolResults.push({
                        callId,
                        text: toolTexts.join("\n").trim(),
                        images: toolImages,
                    });
                } else if (part instanceof vscode.LanguageModelThinkingPart) {
                    const content = Array.isArray(part.value) ? part.value.join("") : part.value;
                    reasoningParts.push(content);
                }
            }

            // Persisted ask_image exchanges are replayed as ordinary
            // functionCall / functionResponse pairs before this message.
            for (const entry of visionHistory) {
                contents.push(...toGoogleVisionToolMessages(entry));
            }

            if (role === "system") {
                const text = textParts.join("").trim();
                if (text) {
                    systemTexts.push(text);
                }
                continue;
            }

            if (role === "assistant") {
                const parts: GooglePart[] = [];
                const thinking = reasoningParts.join("").trim();
                if (modelConfig.includeReasoningInRequest && thinking) {
                    parts.push({ text: thinking, thought: true });
                }
                const text = textParts.join("").trim();
                if (text) {
                    parts.push({ text });
                }
                for (const call of toolCalls) {
                    parts.push({
                        functionCall: call,
                        // Gemini 3+ requires a signature on replayed function
                        // calls. We cannot recover VS Code's original signature,
                        // so use the documented sentinel.
                        thoughtSignature: SKIP_THOUGHT_SIGNATURE_VALIDATOR,
                    });
                }
                if (parts.length > 0) {
                    contents.push({ role: "model", parts });
                }
            }

            // Tool results become functionResponse parts in a user content block.
            if (toolResults.length > 0) {
                const parts: GooglePart[] = [];
                for (const result of toolResults) {
                    const name = toolNameByCallId.get(result.callId) ?? "unknown_tool";
                    parts.push({
                        functionResponse: {
                            id: result.callId,
                            name,
                            response: {
                                name,
                                content: result.text || "Tool executed successfully.",
                            },
                            ...(result.images.length > 0 ? { parts: result.images } : {}),
                        },
                    });
                }
                contents.push({ role: "user", parts });
            }

            if (role === "user") {
                const parts: GooglePart[] = [];
                const text = textParts.join("").trim();
                if (text) {
                    parts.push({ text });
                }
                for (const image of imageParts) {
                    parts.push({
                        inlineData: {
                            mimeType: image.mimeType,
                            data: toBase64(image.data),
                        },
                    });
                }
                if (parts.length > 0) {
                    contents.push({ role: "user", parts });
                }
            }
        }

        this._systemContent = systemTexts.length > 0 ? systemTexts.join("\n\n") : undefined;
        this._originalApiMessages = contents;
        return contents;
    }

    /**
     * Build the Gemini generationConfig, systemInstruction, tools and toolConfig.
     */
    prepareRequestBody(
        rb: GoogleRequestBody,
        um: OpenCodeGoModelItem | undefined,
        options?: ProvideLanguageModelChatResponseOptions
    ): GoogleRequestBody {
        const generationConfig: GoogleGenerationConfig = {};

        if (um?.supportsTemperature !== false && um?.temperature !== undefined && um.temperature !== null) {
            generationConfig.temperature = um.temperature;
        }
        if (um?.top_p !== undefined && um.top_p !== null) {
            generationConfig.topP = um.top_p;
        }
        if (um?.top_k !== undefined) {
            generationConfig.topK = um.top_k;
        }
        const maxOutputTokens = um?.max_completion_tokens ?? um?.max_tokens;
        if (maxOutputTokens !== undefined) {
            generationConfig.maxOutputTokens = maxOutputTokens;
        }

        const stop = (options?.modelOptions as Record<string, unknown> | undefined)?.stop;
        if (typeof stop === "string") {
            generationConfig.stopSequences = [stop];
        } else if (Array.isArray(stop) && stop.every((value) => typeof value === "string")) {
            generationConfig.stopSequences = stop as string[];
        }

        const thinkingConfig = buildGoogleThinkingConfig(um);
        if (thinkingConfig) {
            generationConfig.thinkingConfig = thinkingConfig;
        }
        if (Object.keys(generationConfig).length > 0) {
            rb.generationConfig = generationConfig;
        }

        if (this._systemContent) {
            rb.systemInstruction = { parts: [{ text: this._systemContent }] };
        }

        const declarations: GoogleFunctionDeclaration[] = [];
        const toolConfig = convertToolsToOpenAI(options);
        if (toolConfig.tools) {
            for (const tool of toolConfig.tools) {
                declarations.push({
                    name: tool.function.name,
                    description: tool.function.description,
                    parametersJsonSchema: tool.function.parameters as Record<string, unknown> | undefined,
                });
            }
        }
        if (this._hasImages) {
            for (const def of [ASK_IMAGE_TOOL_DEF, ...(this._localImages.length >= 2 ? [ASK_WITH_MULTI_IMAGE_TOOL_DEF] : [])]) {
                declarations.push({
                    name: def.function.name,
                    description: def.function.description,
                    parametersJsonSchema: def.function.parameters,
                });
            }
        }
        if (declarations.length > 0) {
            rb.tools = [{ functionDeclarations: declarations }];
        }

        if (this._hasImages) {
            // Let the model choose ask_image freely (same policy as the other adapters).
            rb.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
        } else if (toolConfig.tool_choice === "required") {
            rb.toolConfig = { functionCallingConfig: { mode: "ANY" } };
        } else if (toolConfig.tool_choice === "none") {
            rb.toolConfig = { functionCallingConfig: { mode: "NONE" } };
        } else if (toolConfig.tool_choice === "auto") {
            rb.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
        }

        // Extra request-body parameters (reserved keys are ignored).
        const GOOGLE_RESERVED_EXTRA_KEYS = new Set([
            "contents", "systemInstruction", "generationConfig", "tools", "toolConfig",
        ]);
        if (um?.extra && typeof um.extra === "object") {
            for (const [key, value] of Object.entries(um.extra)) {
                if (GOOGLE_RESERVED_EXTRA_KEYS.has(key)) {
                    logger.warn("extra.conflict", { key, file: "googleApi" });
                    continue;
                }
                if (value !== undefined) {
                    (rb as unknown as Record<string, unknown>)[key] = value;
                }
            }
        }

        return rb;
    }

    /**
     * Parse the Gemini SSE stream and report text, thinking and tool-call parts.
     *
     * Usage metadata is cumulative per chunk, so it is reported once after the
     * stream finishes instead of on every chunk (which would double-count in
     * the status bar aggregator).
     */
    async processStreamingResponse(
        responseBody: ReadableStream<Uint8Array>,
        progress: Progress<LanguageModelResponsePart>,
        token: CancellationToken
    ): Promise<void> {
        const modelId = this._modelId;
        logger.debug("google.stream.start", { modelId });
        this._resetStreamState();

        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let latestUsage: GoogleUsageMetadata | undefined;
        let cancelDisposable: vscode.Disposable | undefined;

        if (token.onCancellationRequested) {
            cancelDisposable = token.onCancellationRequested(() => {
                reader.cancel().catch(() => { });
            });
        }

        try {
            while (true) {
                if (token.isCancellationRequested) {
                    break;
                }
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:")) {
                        continue;
                    }
                    const data = trimmed.slice(5).trim();
                    if (!data) {
                        continue;
                    }
                    if (data === "[DONE]") {
                        continue;
                    }
                    logger.debug("google.stream.chunk", { modelId, data });
                    let parsed: GoogleGenerateContentResponse;
                    try {
                        parsed = JSON.parse(data) as GoogleGenerateContentResponse;
                    } catch (err) {
                        logger.error("google.stream.chunk.error", {
                            modelId,
                            error: err instanceof Error ? err.message : String(err),
                            data,
                        });
                        continue;
                    }
                    if (parsed.usageMetadata) {
                        latestUsage = parsed.usageMetadata;
                    }
                    this.processChunk(parsed, progress);
                }
            }
            logger.debug("google.stream.done", { modelId });
        } catch (err) {
            logger.error("google.stream.error", {
                modelId,
                error: err instanceof Error ? err.message : String(err),
            });
            throw err;
        } finally {
            cancelDisposable?.dispose();
            reader.releaseLock();
            this.reportEndThinking(progress);
            if (latestUsage) {
                this.reportUsage(latestUsage);
            }
        }
    }

    /** Process one parsed SSE chunk. */
    private processChunk(
        chunk: GoogleGenerateContentResponse,
        progress: Progress<LanguageModelResponsePart>
    ): void {
        const candidate = chunk.candidates?.[0];
        if (!candidate) {
            const blockReason = chunk.promptFeedback?.blockReason;
            if (blockReason) {
                const message = chunk.promptFeedback?.blockReasonMessage;
                throw new Error(
                    `Google API blocked the prompt: ${blockReason}${message ? ` (${message})` : ""}`
                );
            }
            return;
        }

        for (const part of candidate.content?.parts ?? []) {
            if (part.text !== undefined && part.text !== null) {
                if (part.thought === true) {
                    this._capturedReasoningContent += part.text;
                    this.bufferThinkingContent(part.text, progress);
                } else {
                    this.reportEndThinking(progress);
                    if (this.processTextContent(part.text, progress).emittedAny) {
                        this._hasEmittedAssistantText = true;
                    }
                }
                continue;
            }

            if (part.functionCall) {
                this.reportEndThinking(progress);
                this.processFunctionCall(part.functionCall, progress);
                continue;
            }

            if (part.inlineData) {
                // Output images are not part of VS Code's text/tool stream; log
                // for diagnostics rather than silently dropping them.
                logger.debug("google.stream.inlineData", {
                    modelId: this._modelId,
                    mimeType: part.inlineData.mimeType,
                    bytes: part.inlineData.data.length,
                });
            }
        }

        if (candidate.finishReason && candidate.finishReason !== "STOP") {
            logger.warn("google.stream.finish", {
                modelId: this._modelId,
                finishReason: candidate.finishReason,
            });
        }
    }

    /** Emit or intercept a complete functionCall part. */
    private processFunctionCall(
        call: { id?: string; name: string; args?: Record<string, unknown> },
        progress: Progress<LanguageModelResponsePart>
    ): void {
        const id = call.id || `call_${Math.random().toString(36).slice(2, 10)}`;
        const args = call.args ?? {};
        if (call.name === ASK_IMAGE_TOOL_NAME || call.name === ASK_WITH_MULTI_IMAGE_TOOL_NAME) {
            this.interceptedToolCall = {
                id,
                name: call.name,
                args: args as { imageIndex?: number; imageIndices?: number[]; query: string },
            };
            return;
        }
        if (!this._emittedBeginToolCallsHint && this._hasEmittedAssistantText) {
            progress.report(new vscode.LanguageModelTextPart(" "));
            this._emittedBeginToolCallsHint = true;
        }
        progress.report(new vscode.LanguageModelToolCallPart(id, call.name, args));
    }

    /** Report Gemini usage metadata once at the end of the stream. */
    private reportUsage(usage: GoogleUsageMetadata): void {
        const promptTokens = (usage.promptTokenCount ?? 0) + (usage.toolUsePromptTokenCount ?? 0);
        const completionTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
        const cacheHitTokens = usage.cachedContentTokenCount;
        const result: StreamUsage = {
            promptTokens,
            completionTokens,
            cacheHitTokens,
            cacheMissTokens: cacheHitTokens !== undefined ? Math.max(0, promptTokens - cacheHitTokens) : undefined,
        };
        this._onUsage?.(result);
    }

    /**
     * Create a non-streaming text stream (used for Git commit generation).
     */
    async *createMessage(
        model: OpenCodeGoModelItem,
        systemPrompt: string,
        messages: { role: string; content: string }[],
        baseUrl: string,
        apiKey: string,
        signal?: AbortSignal
    ): AsyncGenerator<{ type: "text"; text: string }> {
        const contents: GoogleContent[] = messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
        }));

        let requestBody: GoogleRequestBody = { contents };
        if (systemPrompt) {
            requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
        }
        requestBody = this.prepareRequestBody(requestBody, model, undefined);

        const headers = CommonApi.prepareHeaders(apiKey, model.apiMode ?? "google", model.headers);
        const modelPath = encodeURIComponent(model.id);
        const url = `${baseUrl.replace(/\/+$/, "")}/models/${modelPath}:streamGenerateContent?alt=sse`;

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
            signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Google API error: [${response.status}] ${response.statusText}${errorText ? `\n${errorText}` : ""}\nURL: ${url}`
            );
        }
        if (!response.body) {
            throw new Error("No response body from Google API");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (signal) {
            signal.addEventListener("abort", () => {
                reader.cancel().catch(() => { });
            });
        }

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:")) {
                        continue;
                    }
                    const data = trimmed.slice(5).trim();
                    if (!data || data === "[DONE]") {
                        continue;
                    }
                    let parsed: GoogleGenerateContentResponse;
                    try {
                        parsed = JSON.parse(data) as GoogleGenerateContentResponse;
                    } catch {
                        continue;
                    }
                    for (const part of parsed.candidates?.[0]?.content?.parts ?? []) {
                        if (part.text && part.thought !== true) {
                            yield { type: "text", text: part.text };
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
}

/**
 * Map the model's reasoning settings onto Gemini's thinkingConfig.
 *
 * Gemini 4 Argon always thinks; there is no true off switch. A disabled
 * selection therefore only hides thought summaries instead of sending an
 * unsupported level (the UI never offers it — see MODEL_OVERRIDES).
 */
export function buildGoogleThinkingConfig(um?: OpenCodeGoModelItem): GoogleThinkingConfig | undefined {
    const effort = um?.reasoning_effort;
    if (um?.enable_thinking === false) {
        return { includeThoughts: false };
    }
    switch (effort) {
        case "low":
        case "medium":
        case "high":
            return { thinkingLevel: effort, includeThoughts: true };
        case "minimal":
            return { thinkingLevel: "minimal", includeThoughts: true };
        case "xhigh":
        case "max":
            return { thinkingLevel: "high", includeThoughts: true };
        default:
            // "enabled", "adaptive" or no effort: use the model default level
            // (medium for Gemini 4 Argon) while still surfacing thoughts.
            return { includeThoughts: true };
    }
}
