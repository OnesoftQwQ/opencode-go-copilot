import * as vscode from "vscode"
import type { StreamUsage } from "./commonApi"

/**
 * MIME type recognized by VS Code Copilot Chat to update the context window
 * ("驾驶舱") with token usage statistics.
 */
const COPILOT_USAGE_DATA_PART_MIME = "usage"

/**
 * Report token usage to Copilot Chat's context window (the "cockpit" / "驾驶舱").
 * This sends a LanguageModelDataPart with MIME type "usage" that VS Code
 * Copilot Chat recognizes and uses to update its context progress display.
 *
 * @param progress - The progress reporter from provideLanguageModelChatResponse.
 * @param usage - Token usage data from the API streaming response.
 */
export function reportCopilotContextUsage(
    progress: vscode.Progress<vscode.LanguageModelResponsePart2>,
    usage: StreamUsage
): void {
    const data = {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.promptTokens + usage.completionTokens,
        prompt_tokens_details: {
            cached_tokens: usage.cacheHitTokens ?? 0,
        },
    }

    try {
        progress.report(
            new vscode.LanguageModelDataPart(new TextEncoder().encode(JSON.stringify(data)), COPILOT_USAGE_DATA_PART_MIME)
        )
    } catch (e) {
        // Silently ignore errors — cockpit reporting is best-effort
        console.error("[OpenCodeGo] Failed to report cockpit usage:", e)
    }
}
