import * as vscode from "vscode";
import {
    CancellationToken,
    LanguageModelChatInformation,
    LanguageModelChatProvider,
    LanguageModelChatRequestMessage,
    ProvideLanguageModelChatResponseOptions,
    LanguageModelResponsePart2,
    Progress,
} from "vscode";

import * as path from "path";

import type { OpenCodeGoModelItem } from "./types";

import { createRetryConfig, executeWithRetry } from "./utils";

import { prepareLanguageModelChatInformation } from "./provideModel";
import { getBuiltInModelConfig } from "./models";
import { countMessageTokens } from "./provideToken";
import { updateContextStatusBar, recordUsage, updateCumulativeTooltip } from "./statusBar";
import { OpenaiApi } from "./openai/openaiApi";
import { AnthropicApi } from "./anthropic/anthropicApi";
import type { AnthropicRequestBody } from "./anthropic/anthropicTypes";
import { CommonApi } from "./commonApi";
import { logger } from "./logger";
import { l10n } from "./localize";

/**
 * VS Code Chat provider backed by OpenCode Go API.
 */
export class OpenCodeGoChatModelProvider implements LanguageModelChatProvider {
    /** Track last request completion time for delay calculation. */
    private _lastRequestTime: number | null = null;

    /**
     * Create a provider using the given secret storage for the API key.
     */
    constructor(
        private readonly secrets: vscode.SecretStorage,
        private readonly statusBarItem: vscode.StatusBarItem
    ) { }

    /**
     * Create an undici fetch function with custom bodyTimeout to prevent premature
     * connection termination during long streaming responses.
     * Falls back to global fetch if undici is unavailable.
     */
    private _createFetchWithTimeout(requestTimeoutMs: number): typeof fetch {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const undici = require(path.join(vscode.env.appRoot, 'node_modules', 'undici'));
            const agent = new undici.Agent({ bodyTimeout: requestTimeoutMs });
            return (url: RequestInfo | URL, init?: RequestInit) => {
                return undici.fetch(url, { ...init, dispatcher: agent });
            };
        } catch {
            return fetch;
        }
    }

    /**
     * Get the list of available language models contributed by this provider.
     */
    async provideLanguageModelChatInformation(
        options: { silent: boolean },
        _token: CancellationToken
    ): Promise<LanguageModelChatInformation[]> {
        return prepareLanguageModelChatInformation({ silent: options.silent ?? false }, _token, this.secrets);
    }

    /**
     * Returns the number of tokens for a given text using the model specific tokenizer logic.
     */
    async provideTokenCount(
        _model: LanguageModelChatInformation,
        text: string | LanguageModelChatRequestMessage,
        _token: CancellationToken
    ): Promise<number> {
        return countMessageTokens(text, { includeReasoningInRequest: true });
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
            report: (part) => {
                try {
                    progress.report(part);
                } catch (e) {
                    console.error("[OpenCodeGo] Progress.report failed", {
                        modelId: model.id,
                        error: e instanceof Error ? { name: e.name, message: e.message } : String(e),
                    });
                }
            },
        };
        const requestStartTime = Date.now();

        // Timeout controller (declared outside try so accessible in catch/finally)
        let abortController = new AbortController();
        let requestTimeoutMs = 600000;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let dispatchFetch: typeof fetch;

        try {
            // Get built-in model config
            const config = vscode.workspace.getConfiguration();
            const um: OpenCodeGoModelItem | undefined = getBuiltInModelConfig(model.id);

            // Apply user-configured reasoning effort from model picker UI
            if (um?.enable_thinking && options.modelConfiguration?.reasoningEffort) {
                const effort = options.modelConfiguration.reasoningEffort;
                if (typeof effort === 'string') {
                    um.reasoning_effort = effort;
                }
            }

            // Determine API mode from model config (default: openai)
            const apiMode = um?.apiMode || "openai";
            const baseUrl = um?.baseUrl || "https://opencode.ai/zen/go/v1/";

            logger.info("request.start", {
                modelId: model.id,
                messageCount: messages.length,
                apiMode,
                baseUrl,
            });

            // Prepare model configuration
            const modelConfig = {
                includeReasoningInRequest: um?.include_reasoning_in_request ?? model.id.includes("::Thinking"),
            };

            // Update Token Usage
            updateContextStatusBar(messages, options.tools, model, this.statusBarItem, modelConfig);

            // Apply delay between consecutive requests
            const modelDelay = um?.delay;
            const globalDelay = config.get<number>("opencodego.delay", 0);
            const delayMs = modelDelay !== undefined ? modelDelay : globalDelay;

            if (delayMs > 0 && this._lastRequestTime !== null) {
                const elapsed = Date.now() - this._lastRequestTime;
                if (elapsed < delayMs) {
                    const remainingDelay = delayMs - elapsed;
                    logger.debug("request.delay", { delayMs, elapsed, remainingDelay });
                    await new Promise<void>((resolve) => {
                        const timeout = setTimeout(() => {
                            clearTimeout(timeout);
                            resolve();
                        }, remainingDelay);
                    });
                }
            }

            // Get API key
            const modelApiKey = await this.ensureApiKey();
            if (!modelApiKey) {
                logger.warn("apiKey.missing", {});
                throw new Error(l10n("OpenCode Go API key not found"));
            }

            // Send chat request
            const BASE_URL = baseUrl;
            if (!BASE_URL || !BASE_URL.startsWith("http")) {
                throw new Error(l10n("Invalid base URL configuration."));
            }

            // Get retry config
            const retryConfig = createRetryConfig();

            // Create request timeout abort controller (default: 10 minutes)
            requestTimeoutMs = config.get<number>("opencodego.requestTimeout", 600000);
            abortController = new AbortController();
            timeoutId = setTimeout(() => abortController.abort(), requestTimeoutMs);
            // Create undici fetch with custom bodyTimeout (extends TCP idle timeout during streaming)
            dispatchFetch = this._createFetchWithTimeout(requestTimeoutMs);

            // Prepare headers with custom headers if specified
            const requestHeaders = CommonApi.prepareHeaders(modelApiKey, apiMode, um?.headers);
            logger.debug("request.headers", {
                headers: logger.sanitizeHeaders(requestHeaders as Record<string, string>),
            });
            logger.debug("request.messages.origin", { messages });

            if (apiMode === "anthropic") {
                // Anthropic API mode
                const anthropicApi = new AnthropicApi(model.id);
                const anthropicMessages = anthropicApi.convertMessages(messages, modelConfig);

                // requestBody
                let requestBody: AnthropicRequestBody = {
                    model: um?.id ?? model.id,
                    messages: anthropicMessages,
                    stream: true,
                };
                requestBody = anthropicApi.prepareRequestBody(requestBody, um, options);

                // Build Anthropic messages endpoint URL
                const normalizedBaseUrl = BASE_URL.replace(/\/+$/, "");
                const url = normalizedBaseUrl.endsWith("/v1")
                    ? `${normalizedBaseUrl}/messages`
                    : `${normalizedBaseUrl}/v1/messages`;
                logger.debug("request.body", { url, requestBody });
                const response = await executeWithRetry(async () => {
                    const res = await dispatchFetch(url, {
                        method: "POST",
                        headers: requestHeaders,
                        body: JSON.stringify(requestBody),
                        signal: abortController.signal,
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error("[Anthropic Provider] Anthropic API error response", errorText);
                        throw new Error(
                            `Anthropic API error: [${res.status}] ${res.statusText}${errorText ? `\n${errorText}` : ""}\nURL: ${url}`
                        );
                    }

                    return res;
                }, retryConfig);

                if (!response.body) {
                    throw new Error("No response body from Anthropic API");
                }
                await anthropicApi.processStreamingResponse(response.body, trackingProgress, token);
            } else {
                // OpenAI Chat Completions API mode
                const openaiApi = new OpenaiApi(model.id);
                openaiApi.onUsage = (usage) => {
                    recordUsage(usage);
                    updateCumulativeTooltip(this.statusBarItem);
                };
                const openaiMessages = openaiApi.convertMessages(messages, modelConfig);

                // requestBody
                let requestBody: Record<string, unknown> = {
                    model: um?.id ?? model.id,
                    messages: openaiMessages,
                    stream: true,
                    stream_options: { include_usage: true },
                };

                requestBody = openaiApi.prepareRequestBody(requestBody, um, options);

                // Send chat request with retry
                const url = `${BASE_URL.replace(/\/+$/, "")}/chat/completions`;
                logger.debug("request.body", { url, requestBody });
                const response = await executeWithRetry(async () => {
                    const res = await dispatchFetch(url, {
                        method: "POST",
                        headers: requestHeaders,
                        body: JSON.stringify(requestBody),
                        signal: abortController.signal,
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error("[OpenCodeGo] API error response", errorText);
                        throw new Error(
                            `API error: [${res.status}] ${res.statusText}${errorText ? `\n${errorText}` : ""}\nURL: ${url}`
                        );
                    }

                    return res;
                }, retryConfig);

                if (!response.body) {
                    throw new Error("No response body from API");
                }

                await openaiApi.processStreamingResponse(response.body, trackingProgress, token);
            }
        } catch (err) {
            // Determine if the request was aborted/terminated (friendly message instead of raw error)
            const errMessage = err instanceof Error ? err.message : String(err);
            const isTimeout = abortController.signal.aborted;
            const isForceTerminated =
                !isTimeout &&
                (errMessage.includes("terminated") ||
                 errMessage.includes("aborted") ||
                 (err instanceof Error && err.name === "AbortError"));

            if (isTimeout || isForceTerminated) {
                logger.error("request.timeout", {
                    modelId: model.id,
                    timeoutMs: requestTimeoutMs,
                    durationMs: Date.now() - requestStartTime,
                    reason: isForceTerminated ? "connection_terminated" : "timeout",
                });
                if (isForceTerminated) {
                    throw new Error(l10n("The connection was closed by the server. The generation took too long. Please try again or request shorter content."));
                }
                throw new Error(l10n("Request timed out. The generation took too long. You can increase the timeout in settings (opencodego.requestTimeout)."));
            }

            console.error("[OpenCodeGo] Chat request failed", {
                modelId: model.id,
                messageCount: messages.length,
                error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
            });
            logger.error("request.error", {
                modelId: model.id,
                messageCount: messages.length,
                errorName: err instanceof Error ? err.name : String(err),
                errorMessage: err instanceof Error ? err.message : String(err),
            });
            throw err;
        } finally {
            clearTimeout(timeoutId);
            const durationMs = Date.now() - requestStartTime;
            logger.info("request.end", { modelId: model.id, durationMs });
            this._lastRequestTime = Date.now();
        }
    }

    /**
     * Ensure an API key exists in SecretStorage, optionally prompting the user when not silent.
     */
    private async ensureApiKey(): Promise<string | undefined> {
        let apiKey = await this.secrets.get("opencodego.apiKey");

        if (!apiKey) {
            const entered = await vscode.window.showInputBox({
                title: l10n("OpenCode Go Provider API Key"),
                prompt: l10n("Enter your OpenCode Go API key"),
                ignoreFocusOut: true,
                password: true,
            });
            if (entered && entered.trim()) {
                apiKey = entered.trim();
                await this.secrets.store("opencodego.apiKey", apiKey);
            }
        }

        return apiKey;
    }
}
