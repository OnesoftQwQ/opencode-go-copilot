import * as vscode from "vscode"
import {
    CancellationToken,
    LanguageModelChatRequestMessage,
    ProvideLanguageModelChatResponseOptions,
    LanguageModelResponsePart2,
    Progress,
} from "vscode"

import type { OpenCodeGoModelItem } from "../types"

import type {
    AnthropicMessage,
    AnthropicRequestBody,
    AnthropicContentBlock,
    AnthropicToolUseBlock,
    AnthropicToolResultBlock,
    AnthropicStreamChunk,
} from "./anthropicTypes"

import { isImageMimeType, isToolResultPart, collectToolResultText, convertToolsToOpenAI, mapRole } from "../utils"

import { CommonApi, StreamUsage } from "../commonApi"
import { logger } from "../logger"
import type { StoredImage } from "../vision/types"
import { DESCRIBE_IMAGE_TOOL_NAME, DESCRIBE_IMAGE_TOOL_DEF } from "../vision/types"
import { reportCopilotContextUsage } from "../cockpit"

export class AnthropicApi extends CommonApi<AnthropicMessage, AnthropicRequestBody> {
    constructor(modelId: string) {
        super(modelId)
    }

    /** Whether images were stored during convertMessages for describe_image tool. */
    private _hasStoredImages = false

    /** Accumulated Anthropic usage across message_start and message_delta events. */
    private _accumulatedUsage: {
        inputTokens: number
        outputTokens: number
        cacheCreationTokens?: number
        cacheReadTokens?: number
    } = {
        inputTokens: 0,
        outputTokens: 0,
    }

    /**
     * Convert VS Code chat messages to Anthropic message format.
     * @param messages The VS Code chat messages to convert.
     * @param modelConfig model configuration that may affect message conversion.
     * @returns Anthropic-compatible messages array.
     */
    convertMessages(
        messages: readonly LanguageModelChatRequestMessage[],
        modelConfig: { includeReasoningInRequest: boolean; vision?: boolean }
    ): AnthropicMessage[] {
        const modelSupportsVision = modelConfig.vision !== false
        const out: AnthropicMessage[] = []
        let imageIndex = 0

        // Collect images to store if model doesn't support vision
        let imagesToStore: StoredImage[] | undefined
        if (!modelSupportsVision) {
            for (const m of messages) {
                for (const part of m.content ?? []) {
                    if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
                        if (!imagesToStore) imagesToStore = []
                        imagesToStore.push({
                            data: part.data,
                            mimeType: part.mimeType,
                        })
                    }
                }
            }
            if (imagesToStore && imagesToStore.length > 0) {
                const key = CommonApi.generateImageStoreKey()
                CommonApi.storedImages.set(key, imagesToStore)
                this._imageStoreKey = key
                this._hasStoredImages = true
            }
        }

        for (const m of messages) {
            const role = mapRole(m)
            const textParts: string[] = []
            const imageParts: vscode.LanguageModelDataPart[] = []
            const toolCalls: AnthropicToolUseBlock[] = []
            const toolResults: AnthropicToolResultBlock[] = []
            const thinkingParts: string[] = []

            for (const part of m.content ?? []) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    textParts.push(part.value)
                } else if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
                    imageParts.push(part)
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    const id = part.callId || `toolu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
                    toolCalls.push({
                        type: "tool_use",
                        id,
                        name: part.name,
                        input: (part.input as Record<string, unknown>) ?? {},
                    })
                } else if (isToolResultPart(part)) {
                    const callId = (part as { callId?: string }).callId ?? ""
                    const content = collectToolResultText(part as { content?: ReadonlyArray<unknown> })
                    toolResults.push({
                        type: "tool_result",
                        tool_use_id: callId,
                        content,
                    })
                } else if (part instanceof vscode.LanguageModelThinkingPart) {
                    const content = Array.isArray(part.value) ? part.value.join("") : part.value
                    thinkingParts.push(content)
                }
            }

            const joinedText = textParts.join("").trim()
            const joinedThinking = thinkingParts.join("").trim()

            // Handle system messages separately (Anthropic uses top-level system field)
            if (role === "system") {
                if (joinedText) {
                    this._systemContent = joinedText
                }
                continue
            }

            // Build content blocks for user/assistant messages
            const contentBlocks: AnthropicContentBlock[] = []

            // Add text content
            if (joinedText) {
                contentBlocks.push({
                    type: "text",
                    text: joinedText,
                })
            }

            if (modelSupportsVision) {
                // Add image content (vision model)
                for (const imagePart of imageParts) {
                    const base64Data = Buffer.from(imagePart.data).toString("base64")
                    contentBlocks.push({
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: imagePart.mimeType,
                            data: base64Data,
                        },
                    })
                }
            } else {
                // Non-vision model: add text references for stored images
                for (let i = 0; i < imageParts.length; i++) {
                    contentBlocks.push({
                        type: "text",
                        text: `[The user sent an image (imageIndex=${imageIndex}). I cannot see images - I MUST call the describe_image tool with imageIndex=${imageIndex} to get a description.]`,
                    })
                    imageIndex++
                }
            }

            // Add thinking content for assistant messages
            if (role === "assistant" && modelConfig.includeReasoningInRequest) {
                contentBlocks.push({
                    type: "thinking",
                    thinking: joinedThinking || "Next step.",
                })
            }

            // Add tool calls for assistant messages
            for (const toolCall of toolCalls) {
                contentBlocks.push(toolCall)
            }

            // For tool results, they should be added to user messages
            if (role === "user" && toolResults.length > 0) {
                for (const toolResult of toolResults) {
                    contentBlocks.push(toolResult)
                }
            } else if (toolResults.length > 0) {
                // If tool results appear in non-user messages, log warning
                console.warn("[Anthropic Provider] Tool results found in non-user message, ignoring")
                logger.warn("anthropic.tool-results.non-user", {
                    messageRole: role,
                    toolResultCount: toolResults.length,
                })
            }

            // Only add message if we have content blocks
            if (contentBlocks.length > 0) {
                out.push({
                    role,
                    content: contentBlocks,
                })
            }
        }

        this._originalApiMessages = out as any[]
        return out
    }

    prepareRequestBody(
        rb: AnthropicRequestBody,
        um: OpenCodeGoModelItem | undefined,
        options?: ProvideLanguageModelChatResponseOptions
    ): AnthropicRequestBody {
        // Set max_tokens (required for Anthropic)
        if (um?.max_completion_tokens !== undefined) {
            rb.max_tokens = um.max_completion_tokens
        } else if (um?.max_tokens !== undefined) {
            rb.max_tokens = um.max_tokens
        }

        // Add system content if we extracted it
        if (this._systemContent) {
            rb.system = this._systemContent
        }

        // Add temperature
        if (um?.temperature !== undefined && um.temperature !== null) {
            rb.temperature = um.temperature
        }

        // Add top_p if configured
        if (um?.top_p !== undefined && um.top_p !== null) {
            rb.top_p = um.top_p
        }

        // Add top_k if configured
        if (um?.top_k !== undefined) {
            rb.top_k = um.top_k
        }

        // Add tools configuration
        const toolConfig = convertToolsToOpenAI(options)
        const anthropicToolList: Array<{ name: string; description?: string; input_schema?: object }> = []
        if (toolConfig.tools) {
            for (const tool of toolConfig.tools) {
                anthropicToolList.push({
                    name: tool.function.name,
                    description: tool.function.description,
                    input_schema: tool.function.parameters,
                })
            }
        }
        // Inject describe_image tool for non-vision models with stored images
        if (this._hasStoredImages) {
            const def = DESCRIBE_IMAGE_TOOL_DEF as unknown as {
                function: { name: string; description: string; parameters: object }
            }
            anthropicToolList.push({
                name: def.function.name,
                description: def.function.description,
                input_schema: def.function.parameters,
            })
        }
        if (anthropicToolList.length > 0) {
            rb.tools = anthropicToolList
        }

        // Add tool_choice (Anthropic format)
        if (this._hasStoredImages) {
            // Set to "auto" so the model can freely choose to call describe_image.
            // The converted messages already contain strong directives telling the
            // model it MUST use describe_image, and the tool definition is available.
            rb.tool_choice = { type: "auto" }
        } else if (toolConfig.tool_choice) {
            if (toolConfig.tool_choice === "auto") {
                rb.tool_choice = { type: "auto" }
            } else if (toolConfig.tool_choice === "none") {
                rb.tool_choice = { type: "none" }
            } else if (toolConfig.tool_choice === "required") {
                rb.tool_choice = { type: "any" }
            }
        }

        // Process extra configuration parameters
        if (um?.extra && typeof um.extra === "object") {
            // Add all extra parameters directly to the request body
            for (const [key, value] of Object.entries(um.extra)) {
                if (value !== undefined) {
                    ;(rb as unknown as Record<string, unknown>)[key] = value
                }
            }
        }

        return rb
    }

    /**
     * Process Anthropic streaming response (SSE format).
     * @param responseBody The readable stream body.
     * @param progress Progress reporter for streamed parts.
     * @param token Cancellation token.
     */
    async processStreamingResponse(
        responseBody: ReadableStream<Uint8Array>,
        progress: Progress<LanguageModelResponsePart2>,
        token: CancellationToken
    ): Promise<void> {
        const modelId = this._modelId
        logger.debug("anthropic.stream.start", { modelId })

        const reader = responseBody.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        // Immediately cancel the stream when user cancels, so reader.read() won't stay pending
        if (token.onCancellationRequested) {
            token.onCancellationRequested(() => {
                reader.cancel().catch(() => {})
            })
        }

        try {
            while (true) {
                if (token.isCancellationRequested) {
                    break
                }

                const { done, value } = await reader.read()
                if (done) {
                    break
                }

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() || ""

                for (const line of lines) {
                    if (line.trim() === "") {
                        continue
                    }
                    if (!line.startsWith("data:")) {
                        continue
                    }

                    const data = line.slice(5).trim()
                    logger.debug("anthropic.stream.chunk", { modelId, data })
                    if (data === "[DONE]") {
                        await this.flushToolCallBuffers(progress, false)
                        continue
                    }

                    try {
                        const chunk: AnthropicStreamChunk = JSON.parse(data)
                        await this.processAnthropicChunk(chunk, progress)
                    } catch (e) {
                        console.error("[Anthropic Provider] Failed to parse SSE chunk:", e, "data:", data)
                        logger.error("anthropic.stream.chunk.error", {
                            modelId,
                            error: e instanceof Error ? e.message : String(e),
                            data,
                        })
                    }
                }
            }
            logger.debug("anthropic.stream.done", { modelId })
        } catch (e) {
            console.error("[Anthropic Provider] Streaming response error:", e)
            logger.error("anthropic.stream.error", { modelId, error: e instanceof Error ? e.message : String(e) })
            throw e
        } finally {
            reader.releaseLock()
            this.reportEndThinking(progress)
        }
    }

    /**
     * Process a single Anthropic streaming chunk.
     * @param chunk Parsed Anthropic stream chunk.
     * @param progress Progress reporter for parts.
     */
    private async processAnthropicChunk(
        chunk: AnthropicStreamChunk,
        progress: Progress<LanguageModelResponsePart2>
    ): Promise<void> {
        // Handle ping events (ignore)
        if (chunk.type === "ping") {
            return
        }

        // Handle error events
        if (chunk.type === "error") {
            const errorType = chunk.error?.type || "unknown_error"
            const errorMessage = chunk.error?.message || "Anthropic API streaming error"
            console.error(`[Anthropic Provider] Streaming error: ${errorType} - ${errorMessage}`)
            return
        }

        if (chunk.type === "message_start" && chunk.message) {
            // Accumulate input tokens from message_start (Anthropic provides input_tokens here)
            const msgUsage = (chunk.message as Record<string, unknown>)?.usage as Record<string, number> | undefined
            if (msgUsage) {
                this._accumulatedUsage.inputTokens = msgUsage.input_tokens ?? 0
                this._accumulatedUsage.cacheCreationTokens = msgUsage.cache_creation_input_tokens as number | undefined
                this._accumulatedUsage.cacheReadTokens = msgUsage.cache_read_input_tokens as number | undefined
            }
            return
        }

        if (chunk.type === "message_delta" && chunk.delta) {
            // Accumulate output tokens from message_delta and report usage to cockpit
            const deltaUsage = (chunk as unknown as Record<string, unknown>).usage as Record<string, number> | undefined
            if (deltaUsage) {
                this._accumulatedUsage.outputTokens = deltaUsage.output_tokens ?? 0
                const usage: StreamUsage = {
                    promptTokens: this._accumulatedUsage.inputTokens,
                    completionTokens: this._accumulatedUsage.outputTokens,
                    cacheHitTokens: this._accumulatedUsage.cacheReadTokens,
                    cacheMissTokens: this._accumulatedUsage.cacheCreationTokens,
                }
                this._onUsage?.(usage)
                // Report token usage to Copilot Chat's cockpit (context window display)
                reportCopilotContextUsage(progress, usage)
            }
            return
        }

        if (chunk.type === "content_block_start" && chunk.content_block) {
            // Start of a content block
            if (chunk.content_block.type === "thinking") {
                if (chunk.content_block.thinking) {
                    this.bufferThinkingContent(chunk.content_block.thinking, progress)
                }
            } else if (chunk.content_block.type === "tool_use") {
                // Start tool call block
                if (!this._emittedBeginToolCallsHint && this._hasEmittedAssistantText) {
                    progress.report(new vscode.LanguageModelTextPart(" "))
                    this._emittedBeginToolCallsHint = true
                }
                const idx = (chunk.index as number) ?? 0
                this._toolCallBuffers.set(idx, {
                    id: chunk.content_block.id,
                    name: chunk.content_block.name,
                    args: "",
                })
            } else if (chunk.content_block.type === "text") {
                // Text block start - nothing special to do
            }
        } else if (chunk.type === "content_block_delta" && chunk.delta) {
            if (chunk.delta.type === "text_delta" && chunk.delta.text) {
                progress.report(new vscode.LanguageModelTextPart(chunk.delta.text))
                this._hasEmittedAssistantText = true
            } else if (chunk.delta.type === "thinking_delta" && chunk.delta.thinking) {
                this.bufferThinkingContent(chunk.delta.thinking, progress)
            } else if (chunk.delta.type === "input_json_delta" && chunk.delta.partial_json) {
                const idx = (chunk.index as number) ?? 0
                const buf = this._toolCallBuffers.get(idx)
                if (buf) {
                    buf.args += chunk.delta.partial_json
                    this._toolCallBuffers.set(idx, buf)
                    await this.tryEmitBufferedToolCall(idx, progress)
                }
            } else if (chunk.delta.type === "signature_delta" && chunk.delta.signature) {
                // Signature for thinking block - ignore for now
            }
        } else if (chunk.type === "content_block_stop" || chunk.type === "message_stop") {
            // End of message - ensure thinking is ended and flush all tool calls
            await this.flushToolCallBuffers(progress, false)
            this.reportEndThinking(progress)
        }
    }

    /**
     * Create a non-streaming chat message (for Git commit generation).
     */
    async *createMessage(
        model: OpenCodeGoModelItem,
        systemPrompt: string,
        messages: { role: string; content: string }[],
        baseUrl: string,
        apiKey: string,
        signal?: AbortSignal
    ): AsyncGenerator<{ type: "text"; text: string }> {
        // For Anthropic, we need to separate system prompt from messages
        const anthropicMessages: AnthropicMessage[] = messages.map(m => ({
            role: m.role === "user" || m.role === "assistant" ? m.role : "user",
            content: m.content,
        }))
        this._systemContent = systemPrompt

        // requestBody
        let requestBody: AnthropicRequestBody = {
            model: model.id,
            messages: anthropicMessages,
            stream: true,
        }
        requestBody = this.prepareRequestBody(requestBody, model, undefined)

        const headers = CommonApi.prepareHeaders(apiKey, model.apiMode ?? "openai", model.headers)

        const normalizedBaseUrl = baseUrl.replace(/\/+$/, "")
        const url = normalizedBaseUrl.endsWith("/v1") ? `${normalizedBaseUrl}/messages` : `${normalizedBaseUrl}/v1/messages`

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
            signal,
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Anthropic API request failed: [${response.status}] ${response.statusText}\n${errorText}`)
        }

        if (!response.body) {
            throw new Error("No response body from Anthropic API")
        }

        // Process the response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        // Cancel the reader immediately when abort signal fires
        if (signal) {
            signal.addEventListener("abort", () => {
                reader.cancel().catch(() => {})
            })
        }

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop() || ""

                for (const line of lines) {
                    if (line.trim() === "") continue
                    if (!line.startsWith("data:")) continue

                    const data = line.slice(5).trim()
                    if (data === "[DONE]") continue

                    try {
                        const chunk: AnthropicStreamChunk = JSON.parse(data)

                        if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta" && chunk.delta?.text) {
                            yield { type: "text", text: chunk.delta.text }
                        }

                        if (chunk.type === "message_stop") break

                        if (chunk.type === "error") {
                            const errorType = chunk.error?.type || "unknown_error"
                            const errorMessage = chunk.error?.message || "Anthropic API streaming error"
                            console.error(`[Anthropic Provider] Streaming error: ${errorType} - ${errorMessage}`)
                        }
                    } catch (e) {
                        console.error("[Anthropic Provider] Failed to parse SSE chunk:", e, "data:", data)
                    }
                }
            }
        } finally {
            reader.releaseLock()
        }
    }
}
