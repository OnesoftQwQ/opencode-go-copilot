import * as vscode from "vscode";
import {
    CancellationToken,
    LanguageModelChatRequestMessage,
    ProvideLanguageModelChatResponseOptions,
    LanguageModelResponsePart2,
    Progress,
} from "vscode";

import type { OpenCodeGoModelItem } from "../types";

import type {
    OpenAIChatMessage,
    OpenAIToolCall,
    ChatMessageContent,
    ReasoningDetail,
    ReasoningSummaryDetail,
    ReasoningTextDetail,
} from "./openaiTypes";

import {
    isImageMimeType,
    createDataUrl,
    isToolResultPart,
    collectToolResultText,
    convertToolsToOpenAI,
    mapRole,
} from "../utils";

import { CommonApi, StreamUsage } from "../commonApi";
import { logger } from "../logger";

export class OpenaiApi extends CommonApi<OpenAIChatMessage, Record<string, unknown>> {
    constructor(modelId: string) {
        super(modelId);
    }

    /**
     * Convert VS Code chat request messages into OpenAI-compatible message objects.
     */
    convertMessages(
        messages: readonly LanguageModelChatRequestMessage[],
        modelConfig: { includeReasoningInRequest: boolean }
    ): OpenAIChatMessage[] {
        const out: OpenAIChatMessage[] = [];
        for (const m of messages) {
            const role = mapRole(m);
            const textParts: string[] = [];
            const imageParts: vscode.LanguageModelDataPart[] = [];
            const toolCalls: OpenAIToolCall[] = [];
            const toolResults: { callId: string; content: string }[] = [];
            const reasoningParts: string[] = [];

            for (const part of m.content ?? []) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    textParts.push(part.value);
                } else if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
                    imageParts.push(part);
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    const id = part.callId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    let args = "{}";
                    try {
                        args = JSON.stringify(part.input ?? {});
                    } catch {
                        args = "{}";
                    }
                    toolCalls.push({ id, type: "function", function: { name: part.name, arguments: args } });
                } else if (isToolResultPart(part)) {
                    const callId = (part as { callId?: string }).callId ?? "";
                    const content = collectToolResultText(part as { content?: ReadonlyArray<unknown> });
                    toolResults.push({ callId, content });
                } else if (part instanceof vscode.LanguageModelThinkingPart) {
                    const content = Array.isArray(part.value) ? part.value.join("") : part.value;
                    reasoningParts.push(content);
                }
            }

            const joinedText = textParts.join("").trim();
            const joinedThinking = reasoningParts.join("").trim();

            // process assistant message
            if (role === "assistant") {
                const assistantMessage: OpenAIChatMessage = {
                    role: "assistant",
                };

                if (joinedText) {
                    assistantMessage.content = joinedText;
                }

                if (modelConfig.includeReasoningInRequest) {
                    assistantMessage.reasoning_content = joinedThinking || "Next step.";
                }

                if (toolCalls.length > 0) {
                    assistantMessage.tool_calls = toolCalls;
                }

                if (assistantMessage.content || assistantMessage.reasoning_content || assistantMessage.tool_calls) {
                    out.push(assistantMessage);
                }
            }

            // process tool result messages
            for (const tr of toolResults) {
                out.push({ role: "tool", tool_call_id: tr.callId, content: tr.content || "" });
            }

            // process user messages
            if (role === "user") {
                if (imageParts.length > 0) {
                    // multi-modal message
                    const contentArray: ChatMessageContent[] = [];

                    if (joinedText) {
                        contentArray.push({
                            type: "text",
                            text: joinedText,
                        });
                    }

                    for (const imagePart of imageParts) {
                        const dataUrl = createDataUrl(imagePart);
                        contentArray.push({
                            type: "image_url",
                            image_url: {
                                url: dataUrl,
                            },
                        });
                    }
                    out.push({ role, content: contentArray });
                } else {
                    // text-only message
                    if (joinedText) {
                        out.push({ role, content: joinedText });
                    }
                }
            }

            // process system messages
            if (role === "system" && joinedText) {
                out.push({ role, content: joinedText });
            }
        }
        return out;
    }

    prepareRequestBody(
        rb: Record<string, unknown>,
        um: OpenCodeGoModelItem | undefined,
        options?: ProvideLanguageModelChatResponseOptions
    ): Record<string, unknown> {
        // temperature
        if (um?.temperature !== undefined && um.temperature !== null) {
            rb.temperature = um.temperature;
        }

        // top_p
        if (um?.top_p !== undefined && um.top_p !== null) {
            rb.top_p = um.top_p;
        }

        // max_tokens / max_completion_tokens (mutually exclusive)
        if (um?.max_completion_tokens !== undefined) {
            rb.max_completion_tokens = um.max_completion_tokens;
        } else if (um?.max_tokens !== undefined) {
            rb.max_tokens = um.max_tokens;
        }

        // OpenAI reasoning configuration
        if (um?.reasoning_effort !== undefined) {
            rb.reasoning_effort = um.reasoning_effort;
        }

        // Thinking mode (OpenAI-compatible format: {"thinking": {"type": "enabled"}})
        if (um?.enable_thinking === true) {
            rb.thinking = { type: "enabled" };
            if (um?.thinking_budget !== undefined) {
                (rb.thinking as Record<string, unknown>).budget_tokens = um.thinking_budget;
            }
        } else {
            rb.thinking = { type: "disabled" };
        }

        // OpenRouter/OpenCode Go reasoning configuration
        if (um?.reasoning !== undefined && um.reasoning.enabled !== false) {
            const reasoningObj: Record<string, unknown> = {};
            const effort = um.reasoning.effort;
            if (effort && effort !== "auto") {
                reasoningObj.effort = effort;
            } else {
                reasoningObj.max_tokens = um.reasoning.max_tokens || 2000;
            }
            if (um.reasoning.exclude !== undefined) {
                reasoningObj.exclude = um.reasoning.exclude;
            }
            rb.reasoning = reasoningObj;
        }

        // stop
        if (options?.modelOptions) {
            const mo = options.modelOptions as Record<string, unknown>;
            if (typeof mo.stop === "string" || Array.isArray(mo.stop)) {
                rb.stop = mo.stop;
            }
        }

        // tools
        const toolConfig = convertToolsToOpenAI(options);
        if (toolConfig.tools) {
            rb.tools = toolConfig.tools;
        }
        if (toolConfig.tool_choice) {
            rb.tool_choice = toolConfig.tool_choice;
        }

        // Extra model parameters
        if (um?.top_k !== undefined) { rb.top_k = um.top_k; }
        if (um?.min_p !== undefined) { rb.min_p = um.min_p; }
        if (um?.frequency_penalty !== undefined) { rb.frequency_penalty = um.frequency_penalty; }
        if (um?.presence_penalty !== undefined) { rb.presence_penalty = um.presence_penalty; }
        if (um?.repetition_penalty !== undefined) { rb.repetition_penalty = um.repetition_penalty; }

        // Extra body parameters
        if (um?.extra && typeof um.extra === "object") {
            for (const [key, value] of Object.entries(um.extra)) {
                if (value !== undefined) {
                    rb[key] = value;
                }
            }
        }

        return rb;
    }

    /**
     * Read and parse the SSE streaming response and report parts.
     */
    async processStreamingResponse(
        responseBody: ReadableStream<Uint8Array>,
        progress: Progress<LanguageModelResponsePart2>,
        token: CancellationToken
    ): Promise<void> {
        const modelId = this._modelId;
        logger.debug("openai.stream.start", { modelId });

        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    const data = line.slice(5).trim();
                    logger.debug("openai.stream.chunk", { modelId, data });
                    if (data === "[DONE]") {
                        await this.flushToolCallBuffers(progress, false);
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(data);

                        // Capture usage from stream_options: include_usage chunks (final chunk with no choices)
                        const usageData = parsed.usage as Record<string, unknown> | undefined;
                        if (usageData) {
                            let cacheHitTokens: number | undefined;
                            let cacheMissTokens: number | undefined;

                            // OpenAI format: prompt_tokens_details.cached_tokens
                            const details = usageData.prompt_tokens_details as Record<string, unknown> | undefined;
                            if (details && typeof details.cached_tokens === "number") {
                                cacheHitTokens = details.cached_tokens;
                                cacheMissTokens = ((usageData.prompt_tokens as number) ?? 0) - cacheHitTokens;
                            }

                            // DeepSeek format: prompt_cache_hit_tokens / prompt_cache_miss_tokens (overrides OpenAI)
                            if (typeof usageData.prompt_cache_hit_tokens === "number") {
                                cacheHitTokens = usageData.prompt_cache_hit_tokens as number;
                            }
                            if (typeof usageData.prompt_cache_miss_tokens === "number") {
                                cacheMissTokens = usageData.prompt_cache_miss_tokens as number;
                            }

                            const usage: StreamUsage = {
                                promptTokens: (usageData.prompt_tokens as number) ?? 0,
                                completionTokens: (usageData.completion_tokens as number) ?? 0,
                                cacheHitTokens,
                                cacheMissTokens,
                            };
                            this._onUsage?.(usage);
                        }

                        await this.processDelta(parsed, progress);
                    } catch (e) {
                        console.error("[OpenCodeGo] Failed to parse SSE chunk:", e, "data:", data);
                        logger.error("openai.stream.chunk.error", {
                            modelId,
                            error: e instanceof Error ? e.message : String(e),
                            data,
                        });
                    }
                }
            }
            logger.debug("openai.stream.done", { modelId });
        } catch (e) {
            console.error("[OpenCodeGo] Streaming response error:", e);
            logger.error("openai.stream.error", { modelId, error: e instanceof Error ? e.message : String(e) });
            throw e;
        } finally {
            reader.releaseLock();
            this.reportEndThinking(progress);
        }
    }

    /**
     * Handle a single streamed delta chunk, emitting text and tool call parts.
     */
    private async processDelta(
        delta: Record<string, unknown>,
        progress: Progress<LanguageModelResponsePart2>
    ): Promise<boolean> {
        let emitted = false;
        const choice = (delta.choices as Record<string, unknown>[] | undefined)?.[0];
        if (!choice) {
            return false;
        }

        const deltaObj = choice.delta as Record<string, unknown> | undefined;

        // Process thinking content first (before regular text content)
        try {
            let maybeThinking =
                (choice as Record<string, unknown> | undefined)?.thinking ??
                (deltaObj as Record<string, unknown> | undefined)?.thinking ??
                (deltaObj as Record<string, unknown> | undefined)?.reasoning ??
                (deltaObj as Record<string, unknown> | undefined)?.reasoning_content;

            // OpenRouter reasoning_details array handling
            const maybeReasoningDetails =
                (deltaObj as Record<string, unknown>)?.reasoning_details ??
                (choice as Record<string, unknown>)?.reasoning_details;
            if (maybeReasoningDetails && Array.isArray(maybeReasoningDetails) && maybeReasoningDetails.length > 0) {
                const details: Array<ReasoningDetail> = maybeReasoningDetails as Array<ReasoningDetail>;
                const sortedDetails = details.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

                for (const detail of sortedDetails) {
                    let extractedText = "";
                    if (detail.type === "reasoning.summary") {
                        extractedText = (detail as ReasoningSummaryDetail).summary;
                    } else if (detail.type === "reasoning.text") {
                        extractedText = (detail as ReasoningTextDetail).text;
                    } else if (detail.type === "reasoning.encrypted") {
                        extractedText = "[REDACTED]";
                    } else {
                        extractedText = JSON.stringify(detail);
                    }

                    if (extractedText) {
                        this.bufferThinkingContent(extractedText, progress);
                        emitted = true;
                    }
                }
                maybeThinking = null;
            }

            if (maybeThinking !== undefined && maybeThinking !== null) {
                let text = "";
                if (maybeThinking && typeof maybeThinking === "object") {
                    const mt = maybeThinking as Record<string, unknown>;
                    text = typeof mt["text"] === "string" ? (mt["text"] as string) : JSON.stringify(mt);
                } else if (typeof maybeThinking === "string") {
                    text = maybeThinking;
                }
                if (text) {
                    this.bufferThinkingContent(text, progress);
                    emitted = true;
                }
            }
        } catch (e) {
            console.error("[OpenCodeGo] Failed to process thinking/reasoning_details:", e);
        }

        if (deltaObj?.content) {
            const content = String(deltaObj.content);

            const xmlRes = this.processXmlThinkBlocks(content, progress);
            if (xmlRes.emittedAny) {
                emitted = true;
            } else {
                this.reportEndThinking(progress);
                const res = this.processTextContent(content, progress);
                if (res.emittedAny) {
                    this._hasEmittedAssistantText = true;
                    emitted = true;
                }
            }
        }

        if (deltaObj?.tool_calls) {
            this.reportEndThinking(progress);

            const toolCalls = deltaObj.tool_calls as Array<Record<string, unknown>>;

            if (!this._emittedBeginToolCallsHint && this._hasEmittedAssistantText && toolCalls.length > 0) {
                progress.report(new vscode.LanguageModelTextPart(" "));
                this._emittedBeginToolCallsHint = true;
            }

            for (const tc of toolCalls) {
                const idx = (tc.index as number) ?? 0;
                if (this._completedToolCallIndices.has(idx)) {
                    continue;
                }
                const buf = this._toolCallBuffers.get(idx) ?? { args: "" };
                if (tc.id && typeof tc.id === "string") {
                    buf.id = tc.id as string;
                }
                const func = tc.function as Record<string, unknown> | undefined;
                if (func?.name && typeof func.name === "string") {
                    buf.name = func.name as string;
                }
                if (typeof func?.arguments === "string") {
                    buf.args += func.arguments as string;
                }
                this._toolCallBuffers.set(idx, buf);

                await this.tryEmitBufferedToolCall(idx, progress);
            }
        }

        const finish = (choice.finish_reason as string | undefined) ?? undefined;
        if (finish === "tool_calls" || finish === "stop") {
            await this.flushToolCallBuffers(progress, true);
        }
        return emitted;
    }

    /**
     * Create a non-streaming chat message (for Git commit generation).
     */
    async *createMessage(
        model: OpenCodeGoModelItem,
        systemPrompt: string,
        messages: { role: string; content: string }[],
        baseUrl: string,
        apiKey: string
    ): AsyncGenerator<{ type: "text"; text: string }> {
        const openaiMessages = [...messages];
        if (systemPrompt) {
            openaiMessages.unshift({ role: "system", content: systemPrompt });
        }

        let requestBody: Record<string, unknown> = {
            model: model.id,
            messages: openaiMessages,
            stream: true,
        };
        requestBody = this.prepareRequestBody(requestBody, model, undefined);

        const headers = CommonApi.prepareHeaders(apiKey, model.apiMode ?? "openai", model.headers);

        const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `API error: [${response.status}] ${response.statusText}${errorText ? `\n${errorText}` : ""}\nURL: ${url}`
            );
        }

        if (!response.body) {
            throw new Error("No response body from API");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    const data = line.slice(5).trim();
                    if (data === "[DONE]") {
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        const choice = (parsed.choices as Record<string, unknown>[] | undefined)?.[0];
                        if (choice?.delta) {
                            const deltaObj = choice.delta as Record<string, unknown>;
                            const content = deltaObj.content as string | undefined;
                            if (content) {
                                yield { type: "text", text: content };
                            }
                        }
                    } catch {
                        // Skip unparseable chunks
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
}
