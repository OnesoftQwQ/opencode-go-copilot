import * as vscode from "vscode"
import {
    CancellationToken,
    LanguageModelChatInformation,
    LanguageModelChatProvider,
    LanguageModelChatRequestMessage,
    PrepareLanguageModelChatModelOptions,
    ProvideLanguageModelChatResponseOptions,
    LanguageModelResponsePart2,
    Progress,
} from "vscode"

import * as path from "path"

import type { ModelPreset, OpenCodeGoModelItem } from "./types"

import { createRetryConfig, executeWithRetry } from "./utils"

import { prepareLanguageModelChatInformation } from "./provideModel"
import { getBuiltInModelConfig } from "./models"
import { getZenFreeModelConfig } from "./zen/zenModels"
import { l10nFormat } from "./localize"
import { countMessageTokens } from "./provideToken"
import { updateContextStatusBar, recordUsage, updateCumulativeTooltip } from "./statusBar"
import { OpenaiApi } from "./openai/openaiApi"
import { AnthropicApi } from "./anthropic/anthropicApi"
import type { AnthropicRequestBody } from "./anthropic/anthropicTypes"
import { CommonApi } from "./commonApi"
import { callVisionModel } from "./vision/imageProxy"
import { DESCRIBE_IMAGE_TOOL_NAME } from "./vision/types"
import type { InterceptedToolCall, StoredImage } from "./vision/types"
import { logger } from "./logger"
import { l10n } from "./localize"
import { processToolFlow } from "./tools/flow"

/**
 * VS Code Chat provider backed by OpenCode Go API.
 */
export class OpenCodeGoChatModelProvider implements LanguageModelChatProvider {
    /** Track last request completion time for delay calculation. */
    private _lastRequestTime: number | null = null

    /**
     * Create a provider using the given secret storage for the API key.
     */
    constructor(
        private readonly secrets: vscode.SecretStorage,
        private readonly statusBarItem: vscode.StatusBarItem
    ) {}

    /**
     * Create an undici fetch function with custom bodyTimeout to prevent premature
     * connection termination during long streaming responses.
     * Falls back to global fetch if undici is unavailable.
     */
    private _createFetchWithTimeout(requestTimeoutMs: number): typeof fetch {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const undici = require(path.join(vscode.env.appRoot, "node_modules", "undici"))
            const agent = new undici.Agent({ bodyTimeout: requestTimeoutMs })
            return (url: RequestInfo | URL, init?: RequestInit) => {
                return undici.fetch(url, { ...init, dispatcher: agent })
            }
        } catch {
            return fetch
        }
    }

    /**
     * Get the list of available language models contributed by this provider.
     */
    async provideLanguageModelChatInformation(
        options: PrepareLanguageModelChatModelOptions,
        _token: CancellationToken
    ): Promise<LanguageModelChatInformation[]> {
        return prepareLanguageModelChatInformation(options, _token, this.secrets)
    }

    /**
     * Returns the number of tokens for a given text using the model specific tokenizer logic.
     */
    async provideTokenCount(
        _model: LanguageModelChatInformation,
        text: string | LanguageModelChatRequestMessage,
        _token: CancellationToken
    ): Promise<number> {
        return countMessageTokens(text, { includeReasoningInRequest: true })
    }

    /**
     * Returns the response for a chat request, passing the results to the progress callback.
     */
    async provideLanguageModelChatResponse(
        model: LanguageModelChatInformation,
        messages: readonly LanguageModelChatRequestMessage[],
        options: ProvideLanguageModelChatResponseOptions,
        progress: Progress<LanguageModelResponsePart2>,
        token: CancellationToken
    ): Promise<void> {
        const trackingProgress: Progress<LanguageModelResponsePart2> = {
            report: part => {
                try {
                    progress.report(part)
                } catch (e) {
                    console.error("[OpenCodeGo] Progress.report failed", {
                        modelId: model.id,
                        error: e instanceof Error ? { name: e.name, message: e.message } : String(e),
                    })
                }
            },
        }
        const requestStartTime = Date.now()

        // Timeout controller (declared outside try so accessible in catch/finally)
        let abortController = new AbortController()
        let requestTimeoutMs = 600000
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        let dispatchFetch: typeof fetch

        try {
            const config = vscode.workspace.getConfiguration()

            // ── Tool preflight: stabilize activate_* virtual tools list ──
            const stabilizeToolList = config.get<boolean>("opencodego.experimental.stabilizeToolList", false)
            const toolFlow = processToolFlow({
                stabilizeToolList,
                messages,
                tools: options.tools,
                progress: trackingProgress,
            })
            if (toolFlow.preflightHandled) {
                // Short-circuit: preflight emitted activate_* tool calls,
                // Copilot Chat will re-issue the request with expanded tools.
                return
            }
            if (toolFlow.initialResponseNotice) {
                trackingProgress.report(new vscode.LanguageModelTextPart(toolFlow.initialResponseNotice))
            }
            // Use filtered messages (preflight artifacts removed)
            const chatMessages = toolFlow.messages

            // Get built-in model config (with fallback to Zen free model config)
            let um: OpenCodeGoModelItem | undefined = getBuiltInModelConfig(model.id)
            if (!um) {
                um = getZenFreeModelConfig(model.id)
            }

            // Apply reasoning effort from model configuration to determine thinking mode
            // - "disabled" → turn off thinking (unless model has thinkingMode="always")
            // - "enabled" → turn on thinking with default effort
            // - "high"/"max" → turn on thinking with specified effort
            if (um && options.modelConfiguration?.reasoningEffort) {
                const effort = options.modelConfiguration.reasoningEffort
                if (typeof effort === "string") {
                    if (effort === "disabled") {
                        if (um.thinkingMode !== "always") {
                            um.enable_thinking = false
                            um.include_reasoning_in_request = false
                        }
                    } else {
                        um.enable_thinking = true
                        um.include_reasoning_in_request = true
                        if (effort !== "enabled") {
                            um.reasoning_effort = effort
                        }
                    }
                }
            }

            // Inject temperature & top_p from model preset or custom settings
            if (um) {
                const tempPreset = config.get<string>("opencodego.modelPreset", "custom")
                if (tempPreset !== "custom") {
                    const presets = config.get<ModelPreset[]>("opencodego.modelPresets", [])
                    const matchedPreset = presets.find(p => p.id === tempPreset)
                    if (matchedPreset) {
                        um.temperature = matchedPreset.temperature
                    }
                } else {
                    const userTemperature = config.get<number | null>("opencodego.temperature", null)
                    if (userTemperature !== null) {
                        um.temperature = userTemperature
                    }
                    const userTopP = config.get<number | null>("opencodego.top_p", null)
                    if (userTopP !== null) {
                        um.top_p = userTopP
                    } else {
                        // Keep top_p undefined so the model uses its default
                        um.top_p = undefined
                    }
                }
            }

            // Determine API mode from model config (default: openai)
            const apiMode = um?.apiMode || "openai"
            const baseUrl = um?.baseUrl || "https://opencode.ai/zen/go/v1/"

            logger.info("request.start", {
                modelId: model.id,
                messageCount: messages.length,
                apiMode,
                baseUrl,
            })

            // Prepare model configuration
            const modelConfig = {
                includeReasoningInRequest: um?.include_reasoning_in_request ?? true,
                vision: um?.vision ?? false,
            }

            // Update Token Usage
            updateContextStatusBar(chatMessages, options.tools, model, this.statusBarItem, modelConfig)

            // Apply delay between consecutive requests
            const modelDelay = um?.delay
            const globalDelay = config.get<number>("opencodego.delay", 0)
            const delayMs = modelDelay !== undefined ? modelDelay : globalDelay

            if (delayMs > 0 && this._lastRequestTime !== null) {
                const elapsed = Date.now() - this._lastRequestTime
                if (elapsed < delayMs) {
                    const remainingDelay = delayMs - elapsed
                    logger.debug("request.delay", { delayMs, elapsed, remainingDelay })
                    await new Promise<void>(resolve => {
                        const timeout = setTimeout(() => {
                            clearTimeout(timeout)
                            resolve()
                        }, remainingDelay)
                    })
                }
            }

            // Get API key
            const modelApiKey = await this.ensureApiKey()
            if (!modelApiKey) {
                logger.warn("apiKey.missing", {})
                throw new Error(l10n("OpenCode Go API key not found"))
            }

            // Send chat request
            const BASE_URL = baseUrl
            if (!BASE_URL || !BASE_URL.startsWith("http")) {
                throw new Error(l10n("Invalid base URL configuration."))
            }

            // Get retry config
            const retryConfig = createRetryConfig()

            // Create request timeout abort controller (default: 10 minutes)
            requestTimeoutMs = config.get<number>("opencodego.requestTimeout", 600000)
            abortController = new AbortController()
            timeoutId = setTimeout(() => abortController.abort(), requestTimeoutMs)
            // Connect VS Code cancellation token to abort the fetch immediately when user stops
            if (token.onCancellationRequested) {
                token.onCancellationRequested(() => {
                    if (!abortController.signal.aborted) {
                        abortController.abort()
                    }
                })
            }
            // Create undici fetch with custom bodyTimeout (extends TCP idle timeout during streaming)
            dispatchFetch = this._createFetchWithTimeout(requestTimeoutMs)

            // Prepare headers with custom headers if specified
            const requestHeaders = CommonApi.prepareHeaders(modelApiKey, apiMode, um?.headers)
            logger.debug("request.headers", {
                headers: logger.sanitizeHeaders(requestHeaders as Record<string, string>),
            })
            logger.debug("request.messages.origin", { messages: chatMessages })

            if (apiMode === "anthropic") {
                // Anthropic API mode
                const anthropicApi = new AnthropicApi(model.id)
                const anthropicMessages = anthropicApi.convertMessages(chatMessages, modelConfig)

                // requestBody
                let requestBody: AnthropicRequestBody = {
                    model: um?.id ?? model.id,
                    messages: anthropicMessages,
                    stream: true,
                }
                requestBody = anthropicApi.prepareRequestBody(requestBody, um, options)

                // Build Anthropic messages endpoint URL
                const normalizedBaseUrl = BASE_URL.replace(/\/+$/, "")
                const url = normalizedBaseUrl.endsWith("/v1")
                    ? `${normalizedBaseUrl}/messages`
                    : `${normalizedBaseUrl}/v1/messages`
                logger.debug("request.body", { url, requestBody })
                const response = await executeWithRetry(async () => {
                    const res = await dispatchFetch(url, {
                        method: "POST",
                        headers: requestHeaders,
                        body: JSON.stringify(requestBody),
                        signal: abortController.signal,
                    })

                    if (!res.ok) {
                        const errorText = await res.text()
                        console.error("[Anthropic Provider] Anthropic API error response", errorText)
                        throw new Error(
                            `Anthropic API error: [${res.status}] ${res.statusText}${errorText ? `\n${errorText}` : ""}\nURL: ${url}`
                        )
                    }

                    return res
                }, retryConfig)

                if (!response.body) {
                    throw new Error("No response body from Anthropic API")
                }
                await anthropicApi.processStreamingResponse(response.body, trackingProgress, token)

                // --- Second round: handle describe_image tool call interception ---
                await this._handleInterceptedToolCall({
                    api: anthropicApi,
                    apiMode: "anthropic",
                    model: model,
                    um: um,
                    modelApiKey: modelApiKey,
                    baseUrl: BASE_URL,
                    dispatchFetch: dispatchFetch,
                    requestHeaders: requestHeaders,
                    retryConfig: retryConfig,
                    abortController: abortController,
                    trackingProgress: trackingProgress,
                    token: token,
                })

                // Clean up stored images
                anthropicApi.cleanupStoredImages()
            } else {
                // OpenAI Chat Completions API mode
                const openaiApi = new OpenaiApi(model.id)
                openaiApi.onUsage = usage => {
                    recordUsage(usage)
                    updateCumulativeTooltip(this.statusBarItem)
                }
                const openaiMessages = openaiApi.convertMessages(chatMessages, modelConfig)

                // requestBody
                let requestBody: Record<string, unknown> = {
                    model: um?.id ?? model.id,
                    messages: openaiMessages,
                    stream: true,
                    stream_options: { include_usage: true },
                }

                requestBody = openaiApi.prepareRequestBody(requestBody, um, options)

                // Send chat request with retry
                const url = `${BASE_URL.replace(/\/+$/, "")}/chat/completions`
                logger.debug("request.body", { url, requestBody })
                const response = await executeWithRetry(async () => {
                    const res = await dispatchFetch(url, {
                        method: "POST",
                        headers: requestHeaders,
                        body: JSON.stringify(requestBody),
                        signal: abortController.signal,
                    })

                    if (!res.ok) {
                        const errorText = await res.text()
                        console.error("[OpenCodeGo] API error response", errorText)
                        throw new Error(
                            `API error: [${res.status}] ${res.statusText}${errorText ? `\n${errorText}` : ""}\nURL: ${url}`
                        )
                    }

                    return res
                }, retryConfig)

                if (!response.body) {
                    throw new Error("No response body from API")
                }

                await openaiApi.processStreamingResponse(response.body, trackingProgress, token)

                // --- Second round: handle describe_image tool call interception ---
                await this._handleInterceptedToolCall({
                    api: openaiApi,
                    apiMode: "openai",
                    model: model,
                    um: um,
                    modelApiKey: modelApiKey,
                    baseUrl: BASE_URL,
                    dispatchFetch: dispatchFetch,
                    requestHeaders: requestHeaders,
                    retryConfig: retryConfig,
                    abortController: abortController,
                    trackingProgress: trackingProgress,
                    token: token,
                })

                // Clean up stored images
                openaiApi.cleanupStoredImages()
            }
        } catch (err) {
            // Determine if the request was aborted/terminated (friendly message instead of raw error)
            const errMessage = err instanceof Error ? err.message : String(err)
            const isTimeout = abortController.signal.aborted
            const isForceTerminated =
                !isTimeout &&
                (errMessage.includes("terminated") ||
                    errMessage.includes("aborted") ||
                    (err instanceof Error && err.name === "AbortError"))

            if (isTimeout || isForceTerminated) {
                logger.error("request.timeout", {
                    modelId: model.id,
                    timeoutMs: requestTimeoutMs,
                    durationMs: Date.now() - requestStartTime,
                    reason: isForceTerminated ? "connection_terminated" : "timeout",
                })
                if (isForceTerminated) {
                    throw new Error(
                        l10n(
                            "The connection was closed by the server. The generation took too long. Please try again or request shorter content."
                        )
                    )
                }
                throw new Error(
                    l10n(
                        "Request timed out. The generation took too long. You can increase the timeout in settings (opencodego.requestTimeout)."
                    )
                )
            }

            // Check for Zen free model expiration error
            if (
                errMessage.includes("no longer available as a free model") ||
                errMessage.includes("has transitioned to a paid model")
            ) {
                const caughtModelConfig = getBuiltInModelConfig(model.id) ?? getZenFreeModelConfig(model.id)
                const caughtModelName = caughtModelConfig?.displayName ?? model.id
                logger.error("request.error", {
                    modelId: model.id,
                    error: "zen_free_model_expired",
                    errorMessage: errMessage,
                })
                throw new Error(
                    l10nFormat("{0} is no longer available as a free model. Please use a different model.", caughtModelName)
                )
            }

            console.error("[OpenCodeGo] Chat request failed", {
                modelId: model.id,
                messageCount: messages.length,
                error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
            })
            logger.error("request.error", {
                modelId: model.id,
                messageCount: messages.length,
                errorName: err instanceof Error ? err.name : String(err),
                errorMessage: err instanceof Error ? err.message : String(err),
            })
            throw err
        } finally {
            clearTimeout(timeoutId)
            const durationMs = Date.now() - requestStartTime
            logger.info("request.end", { modelId: model.id, durationMs })
            this._lastRequestTime = Date.now()
        }
    }

    /**
     * Handle a describe_image tool call interception by calling the vision model
     * and making a second round API request with the tool call + description result.
     */
    private async _handleInterceptedToolCall(params: {
        api: CommonApi<any, any>
        apiMode: string
        model: LanguageModelChatInformation
        um: OpenCodeGoModelItem | undefined
        modelApiKey: string
        baseUrl: string
        dispatchFetch: typeof fetch
        requestHeaders: Record<string, string>
        retryConfig: ReturnType<typeof createRetryConfig>
        abortController: AbortController
        trackingProgress: Progress<LanguageModelResponsePart2>
        token: CancellationToken
    }): Promise<void> {
        const intercepted = params.api.interceptedToolCall
        if (!intercepted) {
            logger.debug("vision.no-intercepted-call", {
                hasStoredImages: !!(params.api as any)._imageStoreKey,
                originalMessagesLen: ((params.api as any)._originalApiMessages as any[])?.length ?? 0,
            })
            return
        }

        logger.info("vision.intercepted", {
            toolName: intercepted.name,
            imageIndex: intercepted.args.imageIndex,
            apiMode: params.apiMode,
        })

        const config = vscode.workspace.getConfiguration()
        const visionModelId = config.get<string>("opencodego.visionProxyModel", "qwen3.6-plus")
        const visionPrompt = config.get<string>("opencodego.visionProxyPrompt", "")

        // Get the stored image data
        const storedImage = params.api.getStoredImage(intercepted.args.imageIndex)
        if (!storedImage) {
            logger.warn("vision.image-not-found", { imageIndex: intercepted.args.imageIndex })
            return
        }

        // Emit a brief thinking indicator BEFORE reading the image
        const visionThinkId = `vision_${Date.now()}`
        params.trackingProgress.report(new vscode.LanguageModelThinkingPart(l10n("Reading image..."), visionThinkId))

        // Call vision model to describe the image (result is for internal use only)
        let description: string
        try {
            description = await callVisionModel(
                storedImage.data,
                storedImage.mimeType,
                visionModelId,
                visionPrompt || undefined,
                params.token
            )
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            logger.error("vision.call-failed", { error: errMsg, visionModelId })
            description = "[Image Description unavailable]"
        }

        // Append "done" to the thinking block, then close it.
        // The description is only for the model (second round via tool_result).
        params.trackingProgress.report(new vscode.LanguageModelThinkingPart(l10n(" done"), visionThinkId))
        params.trackingProgress.report(new vscode.LanguageModelThinkingPart("", visionThinkId))

        // Build second-round messages and make another API request
        const api = params.api
        // Get the original API messages (specific to each format)
        const storedMessages = (api as any)._originalApiMessages as any[] | undefined
        if (!storedMessages || storedMessages.length === 0) {
            logger.warn("vision.no-second-round-messages", {})
            return
        }

        const toolCallId = intercepted.id
        const toolArgs = intercepted.args

        if (params.apiMode === "anthropic") {
            // Anthropic format second round
            const secondMessages = [
                ...storedMessages,
                {
                    role: "assistant" as const,
                    content: [{ type: "tool_use" as const, id: toolCallId, name: DESCRIBE_IMAGE_TOOL_NAME, input: toolArgs }],
                },
                {
                    role: "user" as const,
                    content: [{ type: "tool_result" as const, tool_use_id: toolCallId, content: description }],
                },
            ]

            let secondBody: Record<string, unknown> = {
                model: params.um?.id ?? params.model.id,
                messages: secondMessages,
                stream: true,
            }
            // Apply common Anthropic-like params without injecting tools
            if (params.um?.max_completion_tokens !== undefined) {
                secondBody.max_tokens = params.um.max_completion_tokens
            } else if (params.um?.max_tokens !== undefined) {
                secondBody.max_tokens = params.um.max_tokens
            }
            if (params.um?.temperature !== undefined && params.um.temperature !== null) {
                secondBody.temperature = params.um.temperature
            }

            const secondUrl = params.baseUrl.replace(/\/+$/, "")
            const url = secondUrl.endsWith("/v1") ? `${secondUrl}/messages` : `${secondUrl}/v1/messages`

            const secondResponse = await executeWithRetry(async () => {
                const res = await params.dispatchFetch(url, {
                    method: "POST",
                    headers: params.requestHeaders,
                    body: JSON.stringify(secondBody),
                    signal: params.abortController.signal,
                })
                if (!res.ok) {
                    const errorText = await res.text()
                    throw new Error(`Anthropic API error: [${res.status}] ${res.statusText}${errorText ? `\n${errorText}` : ""}`)
                }
                return res
            }, params.retryConfig)

            if (secondResponse.body) {
                await api.processStreamingResponse(secondResponse.body, params.trackingProgress, params.token)
            }
        } else {
            // OpenAI format second round
            const secondMessages = [
                ...storedMessages,
                {
                    role: "assistant" as const,
                    content: null as string | null,
                    // DeepSeek requires reasoning_content when thinking mode is enabled,
                    // even on tool call assistant messages
                    reasoning_content: "Calling describe_image tool to get a description of the user's attached image.",
                    tool_calls: [
                        {
                            id: toolCallId,
                            type: "function" as const,
                            function: {
                                name: DESCRIBE_IMAGE_TOOL_NAME,
                                arguments: JSON.stringify(toolArgs),
                            },
                        },
                    ],
                },
                {
                    role: "tool" as const,
                    tool_call_id: toolCallId,
                    content: description,
                },
            ]

            let secondBody: Record<string, unknown> = {
                model: params.um?.id ?? params.model.id,
                messages: secondMessages,
                stream: true,
                stream_options: { include_usage: true },
            }
            // Apply temperature and other params without injecting tools
            if (params.um?.temperature !== undefined && params.um.temperature !== null) {
                secondBody.temperature = params.um.temperature
            }
            if (params.um?.top_p !== undefined && params.um.top_p !== null) {
                secondBody.top_p = params.um.top_p
            }
            if (params.um?.max_completion_tokens !== undefined) {
                secondBody.max_completion_tokens = params.um.max_completion_tokens
            }
            // Preserve thinking mode for second round (required by DeepSeek)
            if (params.um?.enable_thinking !== false && params.um?.reasoning_effort !== undefined) {
                secondBody.reasoning_effort = params.um.reasoning_effort
            }
            if (params.um?.enable_thinking === true) {
                secondBody.thinking = { type: "enabled" }
            } else {
                secondBody.thinking = { type: "disabled" }
            }

            const url = `${params.baseUrl.replace(/\/+$/, "")}/chat/completions`
            const secondResponse = await executeWithRetry(async () => {
                const res = await params.dispatchFetch(url, {
                    method: "POST",
                    headers: params.requestHeaders,
                    body: JSON.stringify(secondBody),
                    signal: params.abortController.signal,
                })
                if (!res.ok) {
                    const errorText = await res.text()
                    throw new Error(`API error: [${res.status}] ${res.statusText}${errorText ? `\n${errorText}` : ""}`)
                }
                return res
            }, params.retryConfig)

            if (secondResponse.body) {
                await api.processStreamingResponse(secondResponse.body, params.trackingProgress, params.token)
            }
        }
    }

    /**
     * Ensure an API key exists in SecretStorage, optionally prompting the user when not silent.
     */
    private async ensureApiKey(): Promise<string | undefined> {
        let apiKey = await this.secrets.get("opencodego.apiKey")

        if (!apiKey) {
            const entered = await vscode.window.showInputBox({
                title: l10n("OpenCode Go Provider API Key"),
                prompt: l10n("Enter your OpenCode Go API key"),
                ignoreFocusOut: true,
                password: true,
            })
            if (entered && entered.trim()) {
                apiKey = entered.trim()
                await this.secrets.store("opencodego.apiKey", apiKey)
            }
        }

        return apiKey
    }
}
