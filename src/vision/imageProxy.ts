import * as vscode from "vscode";
import { DEFAULT_VISION_PROMPT } from "./types";
import type { StoredImage } from "./types";

// Vendor id this extension registers its chat provider under (see extension.ts
// and the "vendor" contribution in package.json).
const OPENCODEGO_VENDOR = "opencodego";

/**
 * Build a standard set of request options for vision model calls.
 */
function buildVisionOptions(): vscode.LanguageModelChatRequestOptions {
    const options: vscode.LanguageModelChatRequestOptions = {};
    const visionThinking = vscode.workspace.getConfiguration().get<boolean>("opencodego.visionProxyThinking", false);
    if (visionThinking) {
        options.modelOptions = { reasoning_effort: "high" };
    } else {
        options.modelOptions = {
            reasoning_effort: "disabled",
            thinking: { type: "disabled" },
        };
    }
    return options;
}

/**
 * Resolve the LanguageModelChat instance for the configured vision model ID.
 *
 * The `opencodego.visionProxyModel` setting stores a bare model ID (e.g.
 * "qwen3.8-plus"), but the `id` exposed on `LanguageModelChat` by VS Code is
 * the vendor-prefixed full identifier (e.g. "opencodego/qwen3.8-plus"), so an
 * exact `selectChatModels({ id })` lookup never matches a bare ID. Resolution
 * order:
 * 1. Exact full-id match — users may configure "vendor/id" explicitly.
 * 2. Bare-ID suffix match, preferring models registered by this extension's
 *    own vendor to deterministically disambiguate same-named models from other
 *    providers (e.g. "tokenrhythm/kimi-k2.6" vs "opencodego/kimi-k2.6").
 *
 * @returns The matched chat model, or `undefined` when nothing matches.
 */
async function resolveVisionModel(visionModelId: string): Promise<vscode.LanguageModelChat | undefined> {
    const exact = await vscode.lm.selectChatModels({ id: visionModelId });
    if (exact && exact.length > 0) {
        return exact[0];
    }
    const all = await vscode.lm.selectChatModels();
    const candidates = all.filter((model) => {
        const bare = model.id.slice(model.id.lastIndexOf("/") + 1);
        return bare === visionModelId;
    });
    if (candidates.length === 0) {
        return undefined;
    }
    return candidates.find((model) => model.vendor === OPENCODEGO_VENDOR) ?? candidates[0];
}

/**
 * Send a message to a vision model, stream output via progress, and return the full text.
 * progress.onThinking is called for thinking/reasoning chunks, progress.onText for text chunks.
 */
async function sendToVisionModel(
    msg: vscode.LanguageModelChatMessage,
    visionModelId: string,
    token: vscode.CancellationToken,
    progress?: {
        onThinking?: (text: string) => void;
        onText?: (text: string) => void;
    }
): Promise<string> {
    const visionModel = await resolveVisionModel(visionModelId);
    if (!visionModel) {
        throw new Error(`Vision model "${visionModelId}" not found. Check the opencodego.visionProxyModel setting.`);
    }
    const response = await visionModel.sendRequest([msg], buildVisionOptions(), token);
    let result = "";
    for await (const chunk of response.stream) {
        if (chunk instanceof vscode.LanguageModelThinkingPart) {
            const text = Array.isArray(chunk.value) ? chunk.value.join("") : chunk.value;
            if (text) {
                progress?.onThinking?.(text);
            }
        } else if (chunk instanceof vscode.LanguageModelTextPart) {
            result += chunk.value;
            progress?.onText?.(chunk.value);
        }
    }
    return result.trim();
}

/**
 * Call a vision-capable model to answer a question about a single image.
 * Streams the output via progress if provided.
 * @param query The specific question to ask about the image.
 * @returns The answer text from the vision model.
 */
export async function callVisionModel(
    imageData: Uint8Array,
    mimeType: string,
    visionModelId: string,
    query: string | undefined,
    token: vscode.CancellationToken,
    progress?: {
        onThinking?: (text: string) => void;
        onText?: (text: string) => void;
    }
): Promise<string> {
    const dataPart = new vscode.LanguageModelDataPart(imageData, mimeType);
    const prompt = query ?? DEFAULT_VISION_PROMPT;
    const textPart = new vscode.LanguageModelTextPart(prompt);
    const msg = new vscode.LanguageModelChatMessage(
        vscode.LanguageModelChatMessageRole.User,
        [dataPart, textPart]
    );
    return sendToVisionModel(msg, visionModelId, token, progress);
}

/**
 * Call a vision-capable model to answer a question about MULTIPLE images.
 * Sends all images + query in a single message so the model can compare them.
 * Streams the output via progress if provided.
 * @param images Array of { data, mimeType } for each image.
 * @param query The comparison/analysis question.
 * @returns The answer text from the vision model.
 */
export async function callVisionModelMulti(
    images: StoredImage[],
    visionModelId: string,
    query: string | undefined,
    token: vscode.CancellationToken,
    progress?: {
        onThinking?: (text: string) => void;
        onText?: (text: string) => void;
    }
): Promise<string> {
    const prompt = query ?? "Compare and analyze these images. What do you see?";
    const parts: (vscode.LanguageModelDataPart | vscode.LanguageModelTextPart)[] = [];
    for (const img of images) {
        parts.push(new vscode.LanguageModelDataPart(img.data, img.mimeType));
    }
    parts.push(new vscode.LanguageModelTextPart(prompt));
    const msg = new vscode.LanguageModelChatMessage(
        vscode.LanguageModelChatMessageRole.User,
        parts
    );
    return sendToVisionModel(msg, visionModelId, token, progress);
}
