import * as vscode from "vscode"
import { ACTIVATE_TOOL_PREFIX, PREFLIGHT_ACTIVATE_CALL_ID_PREFIX } from "./consts"

/**
 * Result of inspecting the conversation for activate_* preflight state.
 */
export interface ActivatePreflightInspection {
    /** Number of preflight rounds already executed. */
    rounds: number
    /** Names of activate_* tools that have already been called. */
    calledActivatorNames: string[]
    /** Names of activate_* tools that still need to be activated. */
    remainingActivatorNames: string[]
}

/**
 * Inspect the current message history and tool list to determine which
 * activate_* virtual tools have been called and which still need activation.
 */
export function inspectActivatePreflight(
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    tools: readonly vscode.LanguageModelChatTool[] | undefined
): ActivatePreflightInspection {
    const activatorNames = collectActivateToolNames(tools)
    const calledActivatorNames = new Set<string>()
    let rounds = 0

    const latestHumanUserMessageIndex = findLatestHumanUserMessageIndex(messages)
    for (let index = latestHumanUserMessageIndex + 1; index < messages.length; index += 1) {
        for (const part of messages[index].content) {
            const parsed = parsePreflightPart(part)
            if (!parsed) {
                continue
            }

            rounds = Math.max(rounds, parsed.round)
            if (parsed.toolName?.startsWith(ACTIVATE_TOOL_PREFIX)) {
                calledActivatorNames.add(parsed.toolName)
            }
        }
    }

    const remainingActivatorNames = activatorNames.filter(name => !calledActivatorNames.has(name))
    return {
        rounds,
        calledActivatorNames: [...calledActivatorNames],
        remainingActivatorNames,
    }
}

/**
 * Filter out preflight control-flow messages from the conversation,
 * so they are not sent as real API messages.
 */
export function filterPreflightControlFlow(
    messages: readonly vscode.LanguageModelChatRequestMessage[]
): readonly vscode.LanguageModelChatRequestMessage[] {
    let changed = false
    const filteredMessages: vscode.LanguageModelChatRequestMessage[] = []

    for (const message of messages) {
        const hasPreflightPart = message.content.some(isPreflightPart)
        const filteredContent = message.content.filter(
            part => !isPreflightPart(part) && !(hasPreflightPart && isEmptyTextPart(part))
        )
        if (filteredContent.length === message.content.length) {
            filteredMessages.push(message)
            continue
        }

        changed = true
        if (filteredContent.length > 0) {
            filteredMessages.push({ ...message, content: filteredContent })
        }
    }

    return changed ? filteredMessages : messages
}

/**
 * Create a unique preflight tool call ID for a given round and tool name.
 */
export function createPreflightToolCallId(round: number, toolName: string): string {
    return `${PREFLIGHT_ACTIVATE_CALL_ID_PREFIX}${round}:${encodeURIComponent(toolName)}`
}

// ── Internal helpers ──

function collectActivateToolNames(tools: readonly vscode.LanguageModelChatTool[] | undefined): string[] {
    const names: string[] = []
    const seen = new Set<string>()
    for (const tool of tools ?? []) {
        if (!tool.name.startsWith(ACTIVATE_TOOL_PREFIX) || seen.has(tool.name)) {
            continue
        }
        seen.add(tool.name)
        names.push(tool.name)
    }
    return names
}

function findLatestHumanUserMessageIndex(messages: readonly vscode.LanguageModelChatRequestMessage[]): number {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]
        if (message.role !== vscode.LanguageModelChatMessageRole.User) {
            continue
        }
        if (message.content.some(isHumanUserMessagePart)) {
            return index
        }
    }
    return -1
}

function isHumanUserMessagePart(part: unknown): boolean {
    if (part instanceof vscode.LanguageModelToolResultPart) {
        return false
    }
    if (part instanceof vscode.LanguageModelTextPart) {
        return part.value.length > 0
    }
    return true
}

function parsePreflightPart(part: unknown): { round: number; toolName?: string } | undefined {
    if (part instanceof vscode.LanguageModelToolCallPart) {
        return parsePreflightToolCallId(part.callId) ?? undefined
    }
    if (part instanceof vscode.LanguageModelToolResultPart) {
        return parsePreflightToolCallId(part.callId) ?? undefined
    }
    return undefined
}

function isPreflightPart(part: unknown): boolean {
    return (
        (part instanceof vscode.LanguageModelToolCallPart || part instanceof vscode.LanguageModelToolResultPart) &&
        part.callId.startsWith(PREFLIGHT_ACTIVATE_CALL_ID_PREFIX)
    )
}

function isEmptyTextPart(part: unknown): boolean {
    return part instanceof vscode.LanguageModelTextPart && part.value.length === 0
}

function parsePreflightToolCallId(callId: string): { round: number; toolName?: string } | undefined {
    if (!callId.startsWith(PREFLIGHT_ACTIVATE_CALL_ID_PREFIX)) {
        return undefined
    }

    const value = callId.slice(PREFLIGHT_ACTIVATE_CALL_ID_PREFIX.length)
    const separatorIndex = value.indexOf(":")
    if (separatorIndex < 0) {
        return undefined
    }

    const round = Number.parseInt(value.slice(0, separatorIndex), 10)
    if (!Number.isSafeInteger(round) || round < 1) {
        return undefined
    }

    try {
        return { round, toolName: decodeURIComponent(value.slice(separatorIndex + 1)) }
    } catch {
        return { round }
    }
}
