import * as vscode from "vscode";
import type { ResponsesReasoningItem, ResponsesStreamItem } from "./responsesTypes";

/** Hidden MIME used to replay stateless Responses reasoning items. */
export const RESPONSES_REASONING_MIME = "application/vnd.opencodego.responses-reasoning+json";

interface ResponsesReasoningPayload {
    version: 1;
    item: ResponsesReasoningItem;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate a streamed reasoning item for stateless replay. */
export function normalizeResponsesReasoningItem(item: ResponsesStreamItem): ResponsesReasoningItem | null {
    if (
        item.type !== "reasoning" ||
        typeof item.id !== "string" ||
        item.id.length === 0 ||
        typeof item.encrypted_content !== "string" ||
        !Array.isArray(item.summary)
    ) {
        return null;
    }
    const summary = item.summary.filter(
        (part): part is { type: "summary_text"; text: string } =>
            part?.type === "summary_text" && typeof part.text === "string"
    );
    return {
        type: "reasoning",
        id: item.id,
        summary,
        encrypted_content: item.encrypted_content,
    };
}

/** Serialize a validated reasoning item into a hidden response part. */
export function createResponsesReasoningPart(item: ResponsesReasoningItem): vscode.LanguageModelDataPart {
    const payload: ResponsesReasoningPayload = { version: 1, item };
    return new vscode.LanguageModelDataPart(
        new TextEncoder().encode(JSON.stringify(payload)),
        RESPONSES_REASONING_MIME
    );
}

/** Parse a hidden reasoning part carried back by VS Code. */
export function parseResponsesReasoningPart(part: unknown): ResponsesReasoningItem | null {
    if (!(part instanceof vscode.LanguageModelDataPart) || part.mimeType !== RESPONSES_REASONING_MIME) {
        return null;
    }
    try {
        const payload: unknown = JSON.parse(new TextDecoder().decode(part.data));
        if (!isRecord(payload) || payload.version !== 1 || !isRecord(payload.item)) return null;
        return normalizeResponsesReasoningItem(payload.item as ResponsesStreamItem);
    } catch {
        return null;
    }
}
