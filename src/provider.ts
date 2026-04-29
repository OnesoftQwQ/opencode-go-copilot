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

import type { OpenCodeGoModelItem } from "./types";

import { createRetryConfig, executeWithRetry } from "./utils";

import { prepareLanguageModelChatInformation } from "./provideModel";
import { getBuiltInModelConfig } from "./models";
import { countMessageTokens } from "./provideToken";
import { updateContextStatusBar, recordUsage, updateCumulativeTooltip } from "./statusBar";
import { OpenaiApi } from "./openai/openaiApi";
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
        try {
            // Get built-in model config
            const config = vscode.workspace.getConfiguration();
            const um: OpenCodeGoModelItem | undefined = getBuiltInModelConfig(model.id);

            // Only OpenAI Chat Completions API mode is supported
            const apiMode = "openai";
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

            // Prepare headers with custom headers if specified
            const requestHeaders = CommonApi.prepareHeaders(modelApiKey, apiMode, um?.headers);
            logger.debug("request.headers", {
                headers: logger.sanitizeHeaders(requestHeaders as Record<string, string>),
            });
            logger.debug("request.messages.origin", { messages });

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
                const res = await fetch(url, {
                    method: "POST",
                    headers: requestHeaders,
                    body: JSON.stringify(requestBody),
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
        } catch (err) {
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
