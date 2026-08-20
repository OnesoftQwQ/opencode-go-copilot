import type { AnthropicMessage } from "../anthropic/anthropicTypes";
import type { OpenAIChatMessage } from "../openai/openaiTypes";
import type { ResponsesInputItem } from "../openai/responsesTypes";
import { ASK_IMAGE_TOOL_NAME, ASK_WITH_MULTI_IMAGE_TOOL_NAME } from "./types";

/**
 * Private MIME type used to persist intercepted vision tool calls in the
 * provider response. VS Code can carry this DataPart into the next request,
 * while the upstream API receives ordinary tool-call/tool-result messages.
 */
export const VISION_TOOL_HISTORY_MIME = "application/vnd.opencodego.vision-tool-history+json";

export interface VisionToolHistoryArguments {
    imageIndex?: number;
    imageIndices?: number[];
    query: string;
    [key: string]: unknown;
}

export interface VisionToolHistoryEntry {
    id: string;
    name: typeof ASK_IMAGE_TOOL_NAME | typeof ASK_WITH_MULTI_IMAGE_TOOL_NAME;
    args: VisionToolHistoryArguments;
    result: string;
    /** DeepSeek-compatible reasoning content from the assistant tool call. */
    reasoningContent?: string;
}

interface VisionToolHistoryPayload {
    version: 1;
    entry: VisionToolHistoryEntry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseEntry(value: unknown): VisionToolHistoryEntry | null {
    if (!isRecord(value)) {
        return null;
    }

    const { id, name, args, result, reasoningContent } = value;
    if (
        typeof id !== "string" ||
        id.length === 0 ||
        (name !== ASK_IMAGE_TOOL_NAME && name !== ASK_WITH_MULTI_IMAGE_TOOL_NAME) ||
        !isRecord(args) ||
        typeof args.query !== "string" ||
        typeof result !== "string" ||
        (reasoningContent !== undefined && typeof reasoningContent !== "string")
    ) {
        return null;
    }

    if (args.imageIndex !== undefined && !isNonNegativeInteger(args.imageIndex)) {
        return null;
    }
    if (
        args.imageIndices !== undefined &&
        (!Array.isArray(args.imageIndices) || !args.imageIndices.every(isNonNegativeInteger))
    ) {
        return null;
    }

    return {
        id,
        name,
        args: { ...args } as VisionToolHistoryArguments,
        result,
        ...(reasoningContent !== undefined ? { reasoningContent } : {}),
    };
}

/** Serialize one completed vision tool call/result for a DataPart. */
export function serializeVisionToolHistory(entry: VisionToolHistoryEntry): Uint8Array {
    const payload: VisionToolHistoryPayload = { version: 1, entry };
    return new TextEncoder().encode(JSON.stringify(payload));
}

/** Decode and validate a persisted vision tool call/result. */
export function deserializeVisionToolHistory(data: Uint8Array): VisionToolHistoryEntry | null {
    try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(data));
        if (!isRecord(parsed) || parsed.version !== 1) {
            return null;
        }
        return parseEntry(parsed.entry);
    } catch {
        return null;
    }
}

/** Rebuild the standard OpenAI assistant tool-call + tool-result pair. */
export function toOpenAIVisionToolMessages(entry: VisionToolHistoryEntry): OpenAIChatMessage[] {
    const assistantMessage: OpenAIChatMessage = {
        role: "assistant",
        tool_calls: [
            {
                id: entry.id,
                type: "function",
                function: {
                    name: entry.name,
                    arguments: JSON.stringify(entry.args),
                },
            },
        ],
    };
    if (entry.reasoningContent !== undefined) {
        assistantMessage.reasoning_content = entry.reasoningContent;
    }

    return [
        assistantMessage,
        {
            role: "tool",
            tool_call_id: entry.id,
            content: entry.result,
        },
    ];
}

/** Rebuild the standard Responses function call + output pair. */
export function toResponsesVisionToolItems(entry: VisionToolHistoryEntry): ResponsesInputItem[] {
    return [
        {
            type: "function_call",
            call_id: entry.id,
            name: entry.name,
            arguments: JSON.stringify(entry.args),
        },
        {
            type: "function_call_output",
            call_id: entry.id,
            output: entry.result,
        },
    ];
}

/** Rebuild the standard Anthropic assistant tool_use + user tool_result pair. */
export function toAnthropicVisionToolMessages(entry: VisionToolHistoryEntry): AnthropicMessage[] {
    return [
        {
            role: "assistant",
            content: [
                {
                    type: "tool_use",
                    id: entry.id,
                    name: entry.name,
                    input: entry.args,
                },
            ],
        },
        {
            role: "user",
            content: [
                {
                    type: "tool_result",
                    tool_use_id: entry.id,
                    content: entry.result,
                },
            ],
        },
    ];
}
