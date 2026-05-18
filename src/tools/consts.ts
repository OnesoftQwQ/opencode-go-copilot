/**
 * Tool preflight constants for the activate_* virtual tool stabilization system.
 *
 * VS Code Copilot Chat uses `activate_*` prefixed virtual tools to manage
 * built-in plugins (terminal, search, git, etc.). These tools may be lazily
 * expanded across turns, causing the tools list to be unstable — which breaks
 * DeepSeek's context KVCache.
 */

/** DeepSeek Chat Completions API: "A max of 128 functions are supported." */
export const DEEPSEEK_TOOLS_LIMIT = 128

/** All Copilot virtual tools are prefixed with "activate_". */
export const ACTIVATE_TOOL_PREFIX = "activate_"

/** Prefix for preflight tool call IDs to distinguish them from real calls. */
export const PREFLIGHT_ACTIVATE_CALL_ID_PREFIX = "opencodego-preflight-activate:"

/** Maximum preflight rounds per user request before giving up. */
export const MAX_PREFLIGHT_ROUNDS_PER_USER_REQUEST = 3

// Tool drift notice markers (injected as text parts in the conversation)
export const TOOL_DRIFT_NOTICE_START = "[opencodego-tool-drift-notice-start]: #"
export const TOOL_DRIFT_NOTICE_END = "[opencodego-tool-drift-notice-end]: #"
