import * as vscode from "vscode";

/**
 * Private MIME type used to persist an Anthropic signed thinking block across
 * turns. VS Code carries this DataPart into the next request, letting the
 * provider replay `thinking` blocks with the `signature` Anthropic requires.
 *
 * Claude 5.x rejects replayed thinking blocks that omit `signature`
 * (`messages.N.content.M.thinking.signature: Field required`), and the VS Code
 * `LanguageModelThinkingPart` round-trip carries only text, so the opaque
 * signature has to travel in a dedicated DataPart.
 */
export const ANTHROPIC_THINKING_SIGNATURE_MIME = "application/vnd.opencodego.anthropic-thinking+json";

/** A signed thinking block captured from an Anthropic streaming response. */
export interface AnthropicThinkingSignature {
    /** Exact thinking text the signature was computed over. */
    thinking: string;
    /** Opaque signature returned by the Anthropic API. */
    signature: string;
}

interface ThinkingSignaturePayload {
    version: 1;
    thinking: string;
    signature: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Serialize a signed thinking block for a DataPart. */
export function serializeThinkingSignature(entry: AnthropicThinkingSignature): Uint8Array {
    const payload: ThinkingSignaturePayload = {
        version: 1,
        thinking: entry.thinking,
        signature: entry.signature,
    };
    return new TextEncoder().encode(JSON.stringify(payload));
}

/** Decode and validate a persisted signed thinking block. */
export function deserializeThinkingSignature(data: Uint8Array): AnthropicThinkingSignature | null {
    try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(data));
        if (!isRecord(parsed) || parsed.version !== 1) {
            return null;
        }
        const { thinking, signature } = parsed;
        if (typeof thinking !== "string" || typeof signature !== "string" || signature.length === 0) {
            return null;
        }
        return { thinking, signature };
    } catch {
        return null;
    }
}

/** Create the hidden response part carrying a signed thinking block. */
export function createThinkingSignaturePart(entry: AnthropicThinkingSignature): vscode.LanguageModelDataPart {
    return new vscode.LanguageModelDataPart(
        serializeThinkingSignature(entry),
        ANTHROPIC_THINKING_SIGNATURE_MIME
    );
}

/** Parse a persisted thinking-signature DataPart, ignoring all other data parts. */
export function parseThinkingSignaturePart(part: unknown): AnthropicThinkingSignature | null {
    if (!(part instanceof vscode.LanguageModelDataPart) || part.mimeType !== ANTHROPIC_THINKING_SIGNATURE_MIME) {
        return null;
    }
    return deserializeThinkingSignature(part.data);
}
