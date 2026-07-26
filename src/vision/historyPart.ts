import * as vscode from "vscode";
import {
    deserializeVisionToolHistory,
    serializeVisionToolHistory,
    VISION_TOOL_HISTORY_MIME,
    type VisionToolHistoryEntry,
} from "./historyCodec";

/** Create the hidden response part that VS Code can carry into the next turn. */
export function createVisionToolHistoryPart(entry: VisionToolHistoryEntry): vscode.LanguageModelDataPart {
    return new vscode.LanguageModelDataPart(serializeVisionToolHistory(entry), VISION_TOOL_HISTORY_MIME);
}

/** Parse a persisted vision history DataPart, ignoring all other data parts. */
export function parseVisionToolHistoryPart(part: unknown): VisionToolHistoryEntry | null {
    if (!(part instanceof vscode.LanguageModelDataPart) || part.mimeType !== VISION_TOOL_HISTORY_MIME) {
        return null;
    }
    return deserializeVisionToolHistory(part.data);
}
