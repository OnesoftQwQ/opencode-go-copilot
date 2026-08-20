import * as vscode from "vscode";
import {
    CancellationToken,
    LanguageModelChatRequestMessage,
    LanguageModelResponsePart,
    Progress,
    ProvideLanguageModelChatResponseOptions,
} from "vscode";

import { CommonApi, type StreamUsage } from "../commonApi";
import type { OpenCodeGoModelItem } from "../types";
import {
    createDataUrl,
    convertOpenAIToolToResponses,
    convertToolsToResponses,
    isImageMimeType,
    isResourceLinkMimeType,
    isToolResultPart,
    mapRole,
    parseResourceLinkData,
    replaceDataUriImages,
    resolveResourceLinkToImage,
    storeDataUriImages,
} from "../utils";
import { logger } from "../logger";
import type { StoredImage } from "../vision/types";
import { ASK_IMAGE_TOOL_DEF, ASK_WITH_MULTI_IMAGE_TOOL_DEF } from "../vision/types";
import type { OpenAIFunctionToolDef } from "./openaiTypes";
import type {
    ResponsesFunctionCallItem,
    ResponsesFunctionCallOutputItem,
    ResponsesInputContent,
    ResponsesInputItem,
    ResponsesRequestBody,
    ResponsesStreamEvent,
    ResponsesStreamItem,
    ResponsesUsage,
} from "./responsesTypes";

const imageDirective = (imageIndex: number): string =>
    `\n[The user sent an image (imageIndex=${imageIndex}). I am a text-only model and CANNOT see images directly. I MUST call the ask_image tool to learn about it.\n\nRecommended strategy:\n1. First call ask_image for a brief description to get an overview of the image.\n2. Then call ask_image again with specific questions about details you need (e.g., colors, text content, UI elements, error messages, or any other visible information).\n]`;

/** OpenAI Responses protocol adapter. */
export class ResponsesApi extends CommonApi<ResponsesInputItem, ResponsesRequestBody> {
    private _hasImages = false;

    constructor(modelId: string) {
        super(modelId);
    }

    /** Convert VS Code request messages into Responses input items. */
    async convertMessages(
        messages: readonly LanguageModelChatRequestMessage[],
        modelConfig: { includeReasoningInRequest: boolean; vision?: boolean }
    ): Promise<ResponsesInputItem[]> {
        const modelSupportsVision = modelConfig.vision !== false;
        const out: ResponsesInputItem[] = [];
        let imageIndex = 0;

        if (!modelSupportsVision) {
            const imagesToStore: StoredImage[] = [];
            for (const message of messages) {
                for (const part of message.content ?? []) {
                    if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
                        imagesToStore.push({ data: part.data, mimeType: part.mimeType });
                    } else if (part instanceof vscode.LanguageModelTextPart) {
                        storeDataUriImages(part.value, imagesToStore);
                    } else if (isToolResultPart(part)) {
                        for (const inner of (part as { content?: ReadonlyArray<unknown> }).content ?? []) {
                            if (inner instanceof vscode.LanguageModelDataPart && isImageMimeType(inner.mimeType)) {
                                imagesToStore.push({ data: inner.data, mimeType: inner.mimeType });
                            } else if (inner instanceof vscode.LanguageModelTextPart) {
                                storeDataUriImages(inner.value, imagesToStore);
                            } else if (inner instanceof vscode.LanguageModelDataPart && isResourceLinkMimeType(inner.mimeType)) {
                                const stored = await resolveResourceLinkToImage(inner.data);
                                if (stored) imagesToStore.push(stored);
                            }
                        }
                    }
                }
            }
            if (imagesToStore.length > 0) {
                this._localImages = imagesToStore;
                this._hasImages = true;
            }
        }

        for (const message of messages) {
            const role = mapRole(message);
            const textParts: string[] = [];
            const imageParts: vscode.LanguageModelDataPart[] = [];
            const toolCalls: ResponsesFunctionCallItem[] = [];
            const toolResults: ResponsesFunctionCallOutputItem[] = [];

            for (const part of message.content ?? []) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    if (modelSupportsVision) {
                        textParts.push(part.value);
                    } else {
                        const replaced = replaceDataUriImages(part.value, imageIndex);
                        imageIndex += replaced.count;
                        textParts.push(replaced.text);
                    }
                } else if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
                    if (modelSupportsVision) {
                        imageParts.push(part);
                    } else {
                        textParts.push(imageDirective(imageIndex++));
                    }
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    const callId = part.callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    let args = "{}";
                    try {
                        args = JSON.stringify(part.input ?? {});
                    } catch {
                        // Keep a valid empty object when tool input is not serializable.
                    }
                    toolCalls.push({
                        type: "function_call",
                        call_id: callId,
                        name: part.name,
                        arguments: args,
                    });
                } else if (isToolResultPart(part)) {
                    const callId = (part as { callId?: string }).callId ?? "";
                    const resultText: string[] = [];
                    const resultImages: ResponsesInputContent[] = [];
                    for (const inner of (part as { content?: ReadonlyArray<unknown> }).content ?? []) {
                        if (inner instanceof vscode.LanguageModelTextPart) {
                            if (modelSupportsVision) {
                                resultText.push(inner.value);
                            } else {
                                const replaced = replaceDataUriImages(inner.value, imageIndex);
                                imageIndex += replaced.count;
                                resultText.push(replaced.text);
                            }
                        } else if (inner instanceof vscode.LanguageModelDataPart && isImageMimeType(inner.mimeType)) {
                            if (modelSupportsVision) {
                                resultImages.push({ type: "input_image", image_url: createDataUrl(inner) });
                            } else {
                                resultText.push(imageDirective(imageIndex++));
                            }
                        } else if (inner instanceof vscode.LanguageModelDataPart && isResourceLinkMimeType(inner.mimeType)) {
                            const stored = await resolveResourceLinkToImage(inner.data);
                            if (stored) {
                                if (modelSupportsVision) {
                                    const dataPart = new vscode.LanguageModelDataPart(stored.data, stored.mimeType);
                                    resultImages.push({ type: "input_image", image_url: createDataUrl(dataPart) });
                                } else {
                                    resultText.push(imageDirective(imageIndex++));
                                }
                            } else {
                                const link = parseResourceLinkData(inner.data);
                                if (link) resultText.push(`[Tool returned an unresolvable resource link: ${link.uri}]`);
                            }
                        }
                    }

                    const joined = resultText.join("\n").trim();
                    const output = resultImages.length > 0
                        ? [
                            ...(joined ? [{ type: "input_text" as const, text: joined }] : []),
                            ...resultImages,
                        ]
                        : joined;
                    toolResults.push({ type: "function_call_output", call_id: callId, output });
                }
            }

            const joinedText = textParts.join("").trim();

            if (role === "assistant") {
                if (joinedText) {
                    out.push({ role: "assistant", content: [{ type: "output_text", text: joinedText }] });
                }
                out.push(...toolCalls);
                continue;
            }

            if (role === "system") {
                if (joinedText) out.push({ role: "system", content: joinedText });
                continue;
            }

            out.push(...toolResults);
            const userContent: ResponsesInputContent[] = [];
            if (joinedText) userContent.push({ type: "input_text", text: joinedText });
            for (const image of imageParts) {
                userContent.push({ type: "input_image", image_url: createDataUrl(image) });
            }
            if (userContent.length > 0) out.push({ role: "user", content: userContent });
        }

        this._originalApiMessages = out;
        return out;
    }

    /** Apply model and VS Code options to a Responses request body. */
    prepareRequestBody(
        rb: ResponsesRequestBody,
        um: OpenCodeGoModelItem | undefined,
        options?: ProvideLanguageModelChatResponseOptions
    ): ResponsesRequestBody {
        if (um?.temperature !== undefined && um.temperature !== null && um.supportsTemperature !== false) {
            rb.temperature = um.temperature;
        }
        if (um?.top_p !== undefined && um.top_p !== null && um.supportsTemperature !== false) {
            rb.top_p = um.top_p;
        }
        if (um?.max_completion_tokens !== undefined) {
            rb.max_output_tokens = um.max_completion_tokens;
        } else if (um?.max_tokens !== undefined) {
            rb.max_output_tokens = um.max_tokens;
        }

        if (um?.enable_thinking === false) {
            rb.reasoning = { effort: "none" };
        } else {
            const effort = um?.reasoning_effort;
            rb.reasoning = {
                ...(effort && effort !== "adaptive" ? { effort } : {}),
                summary: "auto",
            };
            rb.include = ["reasoning.encrypted_content"];
        }

        const toolConfig = convertToolsToResponses(options);
        const tools = [...(toolConfig.tools ?? [])];
        if (this._hasImages) {
            tools.push(convertOpenAIToolToResponses(ASK_IMAGE_TOOL_DEF as OpenAIFunctionToolDef));
            if (this._localImages.length >= 2) {
                tools.push(convertOpenAIToolToResponses(ASK_WITH_MULTI_IMAGE_TOOL_DEF as OpenAIFunctionToolDef));
            }
        }
        if (tools.length > 0) rb.tools = tools;
        if (this._hasImages) {
            rb.tool_choice = "auto";
        } else if (toolConfig.tool_choice) {
            rb.tool_choice = toolConfig.tool_choice;
        }

        const reserved = new Set([
            "model", "input", "stream", "store", "max_output_tokens", "temperature", "top_p",
            "reasoning", "include", "tools", "tool_choice", "instructions", "text",
        ]);
        if (um?.extra && typeof um.extra === "object") {
            for (const [key, value] of Object.entries(um.extra)) {
                if (reserved.has(key)) {
                    logger.warn("extra.conflict", { key, file: "responsesApi" });
                } else if (value !== undefined) {
                    rb[key] = value;
                }
            }
        }
        return rb;
    }

    private reportUsage(usageData: ResponsesUsage | undefined): void {
        if (!usageData) return;
        const promptTokens = usageData.input_tokens ?? 0;
        const cacheHitTokens = usageData.input_tokens_details?.cached_tokens;
        const usage: StreamUsage = {
            promptTokens,
            completionTokens: usageData.output_tokens ?? 0,
            cacheHitTokens,
            cacheMissTokens: cacheHitTokens === undefined ? undefined : Math.max(0, promptTokens - cacheHitTokens),
        };
        this._onUsage?.(usage);
    }

    private streamIndex(event: ResponsesStreamEvent): number {
        return typeof event.output_index === "number" ? event.output_index : 0;
    }

    private startFunctionCall(event: ResponsesStreamEvent, item: ResponsesStreamItem): void {
        const index = this.streamIndex(event);
        if (this._completedToolCallIndices.has(index)) return;
        const existing = this._toolCallBuffers.get(index);
        this._toolCallBuffers.set(index, {
            id: item.call_id ?? item.id ?? existing?.id,
            name: item.name ?? existing?.name,
            args: existing?.args || item.arguments || "",
        });
    }

    private async processEvent(
        event: ResponsesStreamEvent,
        progress: Progress<LanguageModelResponsePart>
    ): Promise<boolean> {
        switch (event.type) {
            case "response.output_text.delta":
                if (event.delta) {
                    this.reportEndThinking(progress);
                    this.processTextContent(event.delta, progress);
                    this._hasEmittedAssistantText = true;
                }
                return false;

            case "response.reasoning_text.delta":
            case "response.reasoning_summary.delta":
            case "response.reasoning_summary_text.delta":
                if (event.delta) this.bufferThinkingContent(event.delta, progress);
                return false;

            case "response.output_item.added":
                if (event.item?.type === "function_call") this.startFunctionCall(event, event.item);
                return false;

            case "response.function_call_arguments.delta": {
                const index = this.streamIndex(event);
                if (this._completedToolCallIndices.has(index)) return false;
                const buffer = this._toolCallBuffers.get(index) ?? { args: "" };
                if (event.delta) buffer.args += event.delta;
                this._toolCallBuffers.set(index, buffer);
                await this.tryEmitBufferedToolCall(index, progress);
                return false;
            }

            case "response.output_item.done":
                if (event.item?.type === "function_call") {
                    const index = this.streamIndex(event);
                    if (this._completedToolCallIndices.has(index)) return false;
                    const buffer = this._toolCallBuffers.get(index) ?? { args: "" };
                    buffer.id = event.item.call_id ?? event.item.id ?? buffer.id;
                    buffer.name = event.item.name ?? buffer.name;
                    if (typeof event.item.arguments === "string") buffer.args = event.item.arguments;
                    this._toolCallBuffers.set(index, buffer);
                    await this.tryEmitBufferedToolCall(index, progress);
                } else if (event.item?.type === "reasoning") {
                    this.reportEndThinking(progress);
                }
                return false;

            case "response.completed":
            case "response.incomplete":
                await this.flushToolCallBuffers(progress, true);
                this.reportEndThinking(progress);
                this.reportUsage(event.response?.usage);
                return true;

            case "response.failed":
            case "error": {
                const code = event.code ?? event.response?.error?.code;
                const message = event.message ?? event.response?.error?.message ?? "OpenAI Responses stream failed";
                throw new Error(code ? `${code}: ${message}` : message);
            }

            default:
                return false;
        }
    }

    /** Parse Responses SSE events and report VS Code response parts. */
    async processStreamingResponse(
        responseBody: ReadableStream<Uint8Array>,
        progress: Progress<LanguageModelResponsePart>,
        token: CancellationToken
    ): Promise<void> {
        const modelId = this._modelId;
        logger.debug("responses.stream.start", { modelId });
        this._resetStreamState();

        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let terminal = false;
        let cancelDisposable: vscode.Disposable | undefined;
        if (token.onCancellationRequested) {
            cancelDisposable = token.onCancellationRequested(() => {
                reader.cancel().catch(() => { });
            });
        }

        try {
            while (!terminal && !token.isCancellationRequested) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const rawLine of lines) {
                    const line = rawLine.trimEnd();
                    if (!line.startsWith("data:")) continue;
                    const data = line.slice(5).trim();
                    if (!data || data === "[DONE]") continue;

                    let event: ResponsesStreamEvent;
                    try {
                        event = JSON.parse(data) as ResponsesStreamEvent;
                    } catch (error) {
                        logger.error("responses.stream.chunk.error", {
                            modelId,
                            error: error instanceof Error ? error.message : String(error),
                            data,
                        });
                        continue;
                    }
                    terminal = await this.processEvent(event, progress);
                    if (terminal) break;
                }
            }
            if (!terminal) await this.flushToolCallBuffers(progress, false);
            logger.debug("responses.stream.done", { modelId });
        } finally {
            cancelDisposable?.dispose();
            reader.releaseLock();
            this.reportEndThinking(progress);
        }
    }
}
