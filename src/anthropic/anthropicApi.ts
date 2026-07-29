import * as vscode from "vscode";
import {
	CancellationToken,
	LanguageModelChatRequestMessage,
	LanguageModelResponsePart,
	ProvideLanguageModelChatResponseOptions,
	Progress,
} from "vscode";

import type { OpenCodeGoModelItem } from "../types";

import type {
	AnthropicMessage,
	AnthropicRequestBody,
	AnthropicContentBlock,
	AnthropicToolUseBlock,
	AnthropicToolResultBlock,
	AnthropicStreamChunk,
} from "./anthropicTypes";

import { isImageMimeType, isToolResultPart, collectToolResultText, convertToolsToOpenAI, mapRole, storeDataUriImages, replaceDataUriImages } from "../utils";

import { CommonApi } from "../commonApi";
import { logger } from "../logger";
import type { StoredImage } from "../vision/types";
import { ASK_IMAGE_TOOL_NAME, ASK_IMAGE_TOOL_DEF, ASK_WITH_MULTI_IMAGE_TOOL_NAME, ASK_WITH_MULTI_IMAGE_TOOL_DEF } from "../vision/types";
import { parseVisionToolHistoryPart } from "../vision/historyPart";
import { toAnthropicVisionToolMessages, type VisionToolHistoryEntry } from "../vision/historyCodec";

export class AnthropicApi extends CommonApi<AnthropicMessage, AnthropicRequestBody> {
	constructor(modelId: string) {
		super(modelId);
	}

	/** Whether images were found during convertMessages for ask_image tool. */
	private _hasImages = false;

	/** Accumulated input tokens from Anthropic message_start for usage reporting. */
	private _anthropicInputTokens = 0;

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
		const modelSupportsVision = modelConfig.vision !== false;
		const out: AnthropicMessage[] = [];
		let imageIndex = 0;

		// Collect images to instance-local array if model doesn't support vision
		const imagesToStore: StoredImage[] = [];
		if (!modelSupportsVision) {
			for (const m of messages) {
				for (const part of m.content ?? []) {
					if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
						imagesToStore.push({
							data: part.data,
							mimeType: part.mimeType,
						});
					}
					// Also scan inside tool result content for images
					// (e.g., when view_image tool returns an image in a previous turn)
					if (isToolResultPart(part)) {
						const toolContent = (part as { content?: ReadonlyArray<unknown> }).content;
						if (toolContent) {
							for (const inner of toolContent) {
								if (inner instanceof vscode.LanguageModelDataPart && isImageMimeType(inner.mimeType)) {
									imagesToStore.push({
										data: inner.data,
										mimeType: inner.mimeType,
									});
								} else if (inner instanceof vscode.LanguageModelTextPart) {
									// Scan text for base64 data URI images
									storeDataUriImages(inner.value, imagesToStore);
								}
							}
						}
					}
					// Scan direct text parts for base64 data URI images
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
			const toolCalls: AnthropicToolUseBlock[] = [];
			const toolResults: AnthropicToolResultBlock[] = [];
			const thinkingParts: string[] = [];
			const visionToolHistory: VisionToolHistoryEntry[] = [];

			for (const part of m.content ?? []) {
				const historyEntry = parseVisionToolHistoryPart(part);
				if (historyEntry) {
					visionToolHistory.push(historyEntry);
				} else if (part instanceof vscode.LanguageModelTextPart) {
					if (modelSupportsVision) {
						textParts.push(part.value);
					} else {
						const result = replaceDataUriImages(part.value, imageIndex);
						imageIndex += result.count;
						textParts.push(result.text);
					}
				} else if (part instanceof vscode.LanguageModelDataPart && isImageMimeType(part.mimeType)) {
					imageParts.push(part);
				} else if (part instanceof vscode.LanguageModelToolCallPart) {
					const id = part.callId || `toolu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
					toolCalls.push({
						type: "tool_use",
						id,
						name: part.name,
						input: (part.input as Record<string, unknown>) ?? {},
					});
				} else if (isToolResultPart(part)) {
					const callId = (part as { callId?: string }).callId ?? "";
					const toolContent = (part as { content?: ReadonlyArray<unknown> }).content;
					const toolTexts: string[] = [];
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
							} else if (!modelSupportsVision && inner instanceof vscode.LanguageModelDataPart && isImageMimeType(inner.mimeType)) {
								toolTexts.push(`\n[Image data from tool call (imageIndex=${imageIndex}). I am a text-only model and CANNOT see images directly. I MUST call the ask_image tool to learn about it.\n\nRecommended strategy:\n1. First call ask_image for a brief description to get an overview of the image.\n2. Then call ask_image again with specific questions about details you need (e.g., colors, text content, UI elements, error messages, or any other visible information).\n]`);
								imageIndex++;
							}
						}
					}
					const content = toolTexts.join("\n").trim();
					toolResults.push({
						type: "tool_result",
						tool_use_id: callId,
						content,
					});
				} else if (part instanceof vscode.LanguageModelThinkingPart) {
					const content = Array.isArray(part.value) ? part.value.join("") : part.value;
					thinkingParts.push(content);
				}
			}

			const joinedText = textParts.join("").trim();
			const joinedThinking = thinkingParts.join("").trim();

			// Restore persisted vision calls before the normal content of this
			// message, preserving assistant tool_use → user tool_result order.
			for (const entry of visionToolHistory) {
				out.push(...toAnthropicVisionToolMessages(entry));
			}

			// Handle system messages separately (Anthropic uses top-level system field)
			if (role === "system") {
				if (joinedText) {
					this._systemContent = joinedText;
				}
				continue;
			}

			// Build content blocks for user/assistant messages
			const contentBlocks: AnthropicContentBlock[] = [];

			// Add text content
			if (joinedText) {
				contentBlocks.push({
					type: "text",
					text: joinedText,
				});
			}

			if (modelSupportsVision) {
				// Add image content (vision model)
				for (const imagePart of imageParts) {
					const base64Data = Buffer.from(imagePart.data).toString("base64");
					contentBlocks.push({
						type: "image",
						source: {
							type: "base64",
							media_type: imagePart.mimeType,
							data: base64Data,
						},
					});
				}
			} else {
				// Non-vision model: add text references for stored images
				for (let i = 0; i < imageParts.length; i++) {
					contentBlocks.push({
						type: "text",
						text: `[The user sent an image (imageIndex=${imageIndex}). I am a text-only model and CANNOT see images directly. I MUST call the ask_image tool to learn about it.\n\nRecommended strategy:\n1. First call ask_image for a brief description to get an overview of the image.\n2. Then call ask_image again with specific questions about details you need (e.g., colors, text content, UI elements, error messages, or any other visible information).\n]`,
					});
					imageIndex++;
				}
			}

			// Add thinking content for assistant messages
			if (role === "assistant" && modelConfig.includeReasoningInRequest) {
				contentBlocks.push({
					type: "thinking",
					thinking: joinedThinking || "Next step.",
				});
			}

			// Add tool calls for assistant messages
			for (const toolCall of toolCalls) {
				contentBlocks.push(toolCall);
			}

			// For tool results, they should be added to user messages
			if (role === "user" && toolResults.length > 0) {
				for (const toolResult of toolResults) {
					contentBlocks.push(toolResult);
				}
			} else if (toolResults.length > 0) {
				// If tool results appear in non-user messages, log warning
				console.warn("[Anthropic Provider] Tool results found in non-user message, ignoring");
				logger.warn("anthropic.tool-results.non-user", {
					messageRole: role,
					toolResultCount: toolResults.length,
				});
			}

			// Only add message if we have content blocks
			if (contentBlocks.length > 0) {
				out.push({
					role,
					content: contentBlocks,
				});
			}
		}

		this._originalApiMessages = out as any[];
		return out;
	}

	prepareRequestBody(
		rb: AnthropicRequestBody,
		um: OpenCodeGoModelItem | undefined,
		options?: ProvideLanguageModelChatResponseOptions
	): AnthropicRequestBody {
		// Set max_tokens (required for Anthropic)
		if (um?.max_completion_tokens !== undefined) {
			rb.max_tokens = um.max_completion_tokens;
		} else if (um?.max_tokens !== undefined) {
			rb.max_tokens = um.max_tokens;
		}

		// Add system content if we extracted it
		if (this._systemContent) {
			rb.system = this._systemContent;
		}

		// Add temperature
		if (um?.temperature !== undefined && um.temperature !== null) {
			if (um.supportsTemperature !== false) {
				rb.temperature = um.temperature;
			}
		}

		// Add top_p if configured
		if (um?.top_p !== undefined && um.top_p !== null) {
			rb.top_p = um.top_p;
		}

		// Add top_k if configured
		if (um?.top_k !== undefined) {
			rb.top_k = um.top_k;
		}

		// Add thinking mode (Anthropic-compatible format)
		if (um?.enable_thinking === true) {
			if (um?.reasoning_effort === 'adaptive') {
				rb.thinking = { type: "adaptive" };
			} else {
				rb.thinking = { type: "enabled", budget_tokens: 8192 };
			}
		} else {
			rb.thinking = { type: "disabled" };
		}

		// Add tools configuration
		const toolConfig = convertToolsToOpenAI(options);
		const anthropicToolList: Array<{ name: string; description?: string; input_schema?: object }> = [];
		if (toolConfig.tools) {
			for (const tool of toolConfig.tools) {
				anthropicToolList.push({
					name: tool.function.name,
					description: tool.function.description,
					input_schema: tool.function.parameters,
				});
			}
		}
		// Inject ask_image + ask_with_multi_image for non-vision models with stored images
		if (this._hasImages) {
			const imgDef = ASK_IMAGE_TOOL_DEF as unknown as { function: { name: string; description: string; parameters: object } };
			anthropicToolList.push({
				name: imgDef.function.name,
				description: imgDef.function.description,
				input_schema: imgDef.function.parameters,
			});
			if (this._localImages.length >= 2) {
				const multiDef = ASK_WITH_MULTI_IMAGE_TOOL_DEF as unknown as { function: { name: string; description: string; parameters: object } };
				anthropicToolList.push({
					name: multiDef.function.name,
					description: multiDef.function.description,
					input_schema: multiDef.function.parameters,
				});
			}
		}
		if (anthropicToolList.length > 0) {
			rb.tools = anthropicToolList;
		}

		// Add tool_choice (Anthropic format)
		if (this._hasImages) {
			// Set to "auto" so the model can freely choose to call ask_image.
			// The converted messages already contain strong directives telling the
			// model it MUST use ask_image, and the tool definition is available.
			rb.tool_choice = { type: "auto" };
		} else if (toolConfig.tool_choice) {
			if (toolConfig.tool_choice === "auto") {
				rb.tool_choice = { type: "auto" };
			} else if (toolConfig.tool_choice === "none") {
				rb.tool_choice = { type: "none" };
			} else if (toolConfig.tool_choice === "required") {
				rb.tool_choice = { type: "any" };
			}
		}

		// Process extra configuration parameters (filter reserved keys with warning)
		const ANTHROPIC_RESERVED_EXTRA_KEYS = new Set([
			"model", "messages", "stream", "max_tokens", "system",
			"temperature", "top_p", "top_k", "tools", "tool_choice",
		]);
		if (um?.extra && typeof um.extra === "object") {
			for (const [key, value] of Object.entries(um.extra)) {
				if (ANTHROPIC_RESERVED_EXTRA_KEYS.has(key)) {
					logger.warn("extra.conflict", { key, file: "anthropicApi" });
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
	 * Process Anthropic streaming response (SSE format).
	 * @param responseBody The readable stream body.
	 * @param progress Progress reporter for streamed parts.
	 * @param token Cancellation token.
	 */
	async processStreamingResponse(
		responseBody: ReadableStream<Uint8Array>,
		progress: Progress<LanguageModelResponsePart>,
		token: CancellationToken
	): Promise<void> {
		const modelId = this._modelId;
		logger.debug("anthropic.stream.start", { modelId });

		// Reset mutable state to prevent carryover from previous rounds
		this._resetStreamState();

		const reader = responseBody.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let cancelDisposable: vscode.Disposable | undefined;

		// Immediately cancel the stream when user cancels, so reader.read() won't stay pending
		if (token.onCancellationRequested) {
			cancelDisposable = token.onCancellationRequested(() => {
				reader.cancel().catch(() => {});
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
					if (line.trim() === "") {
						continue;
					}
					if (!line.startsWith("data:")) {
						continue;
					}

					const data = line.slice(5).trim();
					logger.debug("anthropic.stream.chunk", { modelId, data });
					if (data === "[DONE]") {
						await this.flushToolCallBuffers(progress, false);
						continue;
					}

					try {
						const chunk: AnthropicStreamChunk = JSON.parse(data);
						await this.processAnthropicChunk(chunk, progress);
					} catch (e) {
						console.error("[Anthropic Provider] Failed to parse SSE chunk:", e, "data:", data);
						logger.error("anthropic.stream.chunk.error", {
							modelId,
							error: e instanceof Error ? e.message : String(e),
							data,
						});
					}
				}
			}
			logger.debug("anthropic.stream.done", { modelId });
		} catch (e) {
			console.error("[Anthropic Provider] Streaming response error:", e);
			logger.error("anthropic.stream.error", { modelId, error: e instanceof Error ? e.message : String(e) });
			throw e;
		} finally {
			cancelDisposable?.dispose();
			reader.releaseLock();
			this.reportEndThinking(progress);
		}
	}

	/**
	 * Process a single Anthropic streaming chunk.
	 * @param chunk Parsed Anthropic stream chunk.
	 * @param progress Progress reporter for parts.
	 */
	private async processAnthropicChunk(
		chunk: AnthropicStreamChunk,
		progress: Progress<LanguageModelResponsePart>
	): Promise<void> {
		// Handle ping events (ignore)
		if (chunk.type === "ping") {
			return;
		}

		// Handle error events
		if (chunk.type === "error") {
			const errorType = chunk.error?.type || "unknown_error";
			const errorMessage = chunk.error?.message || "Anthropic API streaming error";
			console.error(`[Anthropic Provider] Streaming error: ${errorType} - ${errorMessage}`);
			return;
		}

		if (chunk.type === "message_start" && chunk.message) {
			// Extract message metadata (id, model, etc.) and input token count
			const msg = chunk.message as Record<string, unknown>;
			const usage = msg.usage as { input_tokens?: number } | undefined;
			if (usage?.input_tokens) {
				this._anthropicInputTokens = usage.input_tokens;
			}
			return;
		}

		if (chunk.type === "message_delta" && chunk.delta) {
			// Extract stop_reason and usage information
			const chunkUsage = chunk.usage as { output_tokens?: number } | undefined;
			if (chunkUsage?.output_tokens && this._anthropicInputTokens > 0) {
				this._onUsage?.({
					promptTokens: this._anthropicInputTokens,
					completionTokens: chunkUsage.output_tokens,
				});
			}
			return;
		}

		if (chunk.type === "content_block_start" && chunk.content_block) {
			// Start of a content block
			if (chunk.content_block.type === "thinking") {
				if (chunk.content_block.thinking) {
					this.bufferThinkingContent(chunk.content_block.thinking, progress);
				}
			} else if (chunk.content_block.type === "tool_use") {
				// Start tool call block
				if (!this._emittedBeginToolCallsHint && this._hasEmittedAssistantText) {
					progress.report(new vscode.LanguageModelTextPart(" "));
					this._emittedBeginToolCallsHint = true;
				}
				const idx = (chunk.index as number) ?? 0;
				this._toolCallBuffers.set(idx, {
					id: chunk.content_block.id,
					name: chunk.content_block.name,
					args: "",
				});
			} else if (chunk.content_block.type === "text") {
				// Text block start - nothing special to do
			}
		} else if (chunk.type === "content_block_delta" && chunk.delta) {
			if (chunk.delta.type === "text_delta" && chunk.delta.text) {
				progress.report(new vscode.LanguageModelTextPart(chunk.delta.text));
				this._hasEmittedAssistantText = true;
			} else if (chunk.delta.type === "thinking_delta" && chunk.delta.thinking) {
				this.bufferThinkingContent(chunk.delta.thinking, progress);
			} else if (chunk.delta.type === "input_json_delta" && chunk.delta.partial_json) {
				const idx = (chunk.index as number) ?? 0;
				const buf = this._toolCallBuffers.get(idx);
				if (buf) {
					buf.args += chunk.delta.partial_json;
					this._toolCallBuffers.set(idx, buf);
					await this.tryEmitBufferedToolCall(idx, progress);
				}
			} else if (chunk.delta.type === "signature_delta" && chunk.delta.signature) {
				// Signature for thinking block - ignore for now
			}
		} else if (chunk.type === "content_block_stop" || chunk.type === "message_stop") {
			// End of message - ensure thinking is ended and flush all tool calls
			await this.flushToolCallBuffers(progress, false);
			this.reportEndThinking(progress);
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
		const anthropicMessages: AnthropicMessage[] = messages.map((m) => ({
			role: m.role === "user" || m.role === "assistant" ? m.role : "user",
			content: m.content,
		}));
		this._systemContent = systemPrompt;

		// requestBody
		let requestBody: AnthropicRequestBody = {
			model: model.id,
			messages: anthropicMessages,
			stream: true,
		};
		requestBody = this.prepareRequestBody(requestBody, model, undefined);

		const headers = CommonApi.prepareHeaders(apiKey, model.apiMode ?? "openai", model.headers);

		const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
		const url = normalizedBaseUrl.endsWith("/v1")
			? `${normalizedBaseUrl}/messages`
			: `${normalizedBaseUrl}/v1/messages`;

		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
			signal,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Anthropic API request failed: [${response.status}] ${response.statusText}\n${errorText}`);
		}

		if (!response.body) {
			throw new Error("No response body from Anthropic API");
		}

		// Process the response
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		// Cancel the reader immediately when abort signal fires
		if (signal) {
			signal.addEventListener("abort", () => {
				reader.cancel().catch(() => {});
			});
		}

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (line.trim() === "") continue;
					if (!line.startsWith("data:")) continue;

					const data = line.slice(5).trim();
					if (data === "[DONE]") continue;

					try {
						const chunk: AnthropicStreamChunk = JSON.parse(data);

						if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta" && chunk.delta?.text) {
							yield { type: "text", text: chunk.delta.text };
						}

						if (chunk.type === "message_stop") break;

						if (chunk.type === "error") {
							const errorType = chunk.error?.type || "unknown_error";
							const errorMessage = chunk.error?.message || "Anthropic API streaming error";
							console.error(`[Anthropic Provider] Streaming error: ${errorType} - ${errorMessage}`);
						}
					} catch (e) {
						console.error("[Anthropic Provider] Failed to parse SSE chunk:", e, "data:", data);
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
}
