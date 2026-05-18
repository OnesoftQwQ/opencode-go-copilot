import * as vscode from "vscode"
import { ACTIVATE_TOOL_PREFIX, MAX_PREFLIGHT_ROUNDS_PER_USER_REQUEST } from "./consts"
import { createToolDriftNotice, filterProviderNotices } from "./notices"
import { createPreflightToolCallId, filterPreflightControlFlow, inspectActivatePreflight } from "./preflight"

/**
 * Options for the tool flow processing.
 */
export interface ToolFlowOptions {
    /** Whether to enable the experimental tool-list stabilization. */
    stabilizeToolList: boolean
    /** Current conversation messages. */
    messages: readonly vscode.LanguageModelChatRequestMessage[]
    /** Available tools from VS Code. */
    tools: readonly vscode.LanguageModelChatTool[] | undefined
    /** Progress reporter for emitting preflight tool calls. */
    progress: vscode.Progress<vscode.LanguageModelResponsePart2>
}

/**
 * Result of tool flow processing.
 */
export interface ToolFlowResult {
    /** Whether the current request was handled by preflight (API call should be skipped). */
    preflightHandled: boolean
    /** Filtered messages ready for API consumption. */
    messages: readonly vscode.LanguageModelChatRequestMessage[]
    /** Optional initial response notice to show in the chat. */
    initialResponseNotice?: string
}

/**
 * Process the tool flow for a chat request.
 *
 * When stabilizeToolList is enabled, this inspects the conversation for
 * un-activated activate_* virtual tools and emits preflight tool calls
 * to trigger Copilot Chat to expand them. The current request is
 * short-circuited (preflightHandled=true) so that Copilot can process
 * the activation and re-issue the request with a stable tools list.
 *
 * When stabilizeToolList is disabled, this simply filters preflight
 * control-flow artifacts and checks for tool drift.
 */
export function processToolFlow({ stabilizeToolList, messages, tools, progress }: ToolFlowOptions): ToolFlowResult {
    // Always filter out preflight control-flow messages and notices
    const filteredMessages = filterProviderNotices(filterPreflightControlFlow(messages))

    if (!stabilizeToolList) {
        return {
            preflightHandled: false,
            messages: filteredMessages,
        }
    }

    const activatePreflight = inspectActivatePreflight(messages, tools)

    // If there are still activate_* tools that haven't been called, emit them now
    if (activatePreflight.remainingActivatorNames.length > 0) {
        if (activatePreflight.rounds >= MAX_PREFLIGHT_ROUNDS_PER_USER_REQUEST) {
            // We've tried enough rounds — give up and proceed
            console.warn(
                `[OpenCodeGo] Tool preflight: still ${activatePreflight.remainingActivatorNames.length} activate_* tools un-activated after ${activatePreflight.rounds} rounds, proceeding anyway`
            )
            return {
                preflightHandled: false,
                messages: filteredMessages,
            }
        }

        const nextRound = activatePreflight.rounds + 1
        for (const toolName of activatePreflight.remainingActivatorNames) {
            progress.report(new vscode.LanguageModelToolCallPart(createPreflightToolCallId(nextRound, toolName), toolName, {}))
        }

        // Short-circuit: don't call the API yet — wait for Copilot to process
        // the preflight activations and re-issue the request
        return { preflightHandled: true, messages }
    }

    // All activate_* tools have been activated — proceed with the real request.
    // Detect if there's tool drift (activate_* tools present but some may be
    // unstable) and inject a notice if so.
    const hasUnexpandedActivateTools =
        activatePreflight.rounds > 0 && tools?.some(tool => tool.name.startsWith(ACTIVATE_TOOL_PREFIX))

    return {
        preflightHandled: false,
        messages: filteredMessages,
        initialResponseNotice: hasUnexpandedActivateTools ? createToolDriftNotice() : undefined,
    }
}
