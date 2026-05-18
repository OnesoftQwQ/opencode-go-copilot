import * as vscode from "vscode"
import { TOOL_DRIFT_NOTICE_START, TOOL_DRIFT_NOTICE_END } from "./consts"

/**
 * Create a tool-drift notice text part to warn users that the tools list
 * may be unstable across turns (affecting DeepSeek KVCache hit rate).
 */
export function createToolDriftNotice(): string {
    return `${TOOL_DRIFT_NOTICE_START} ${TOOL_DRIFT_NOTICE_END}`
}

/**
 * Filter out previously injected tool-drift notices from messages,
 * keeping the conversation clean for subsequent rounds.
 */
export function filterProviderNotices(
    messages: readonly vscode.LanguageModelChatRequestMessage[]
): readonly vscode.LanguageModelChatRequestMessage[] {
    let changed = false
    const filteredMessages: vscode.LanguageModelChatRequestMessage[] = []

    for (const message of messages) {
        let messageChanged = false
        const filteredContent = message.content.filter(part => {
            if (part instanceof vscode.LanguageModelTextPart) {
                if (part.value.includes(TOOL_DRIFT_NOTICE_START) && part.value.includes(TOOL_DRIFT_NOTICE_END)) {
                    messageChanged = true
                    return false
                }
            }
            return true
        })

        if (messageChanged) {
            changed = true
            if (filteredContent.length > 0) {
                filteredMessages.push({ ...message, content: filteredContent })
            }
        } else {
            filteredMessages.push(message)
        }
    }

    return changed ? filteredMessages : messages
}
