import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Verifies AnthropicApi.convertMessages() merges consecutive tool-result-only
// user messages into a single user message (Anthropic protocol requirement —
// issue #87: "tool_use ids were found without tool_result blocks immediately
// after" 400 errors when a previous turn issued multiple parallel tool calls).

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

class DataPart {
	constructor(data, mimeType) {
		this.data = data;
		this.mimeType = mimeType;
	}
}
class TextPart {
	constructor(value) {
		this.value = value;
	}
}
class ToolCallPart {
	constructor(callId, name, input) {
		this.callId = callId;
		this.name = name;
		this.input = input;
	}
}
class ToolResultPart {
	constructor(callId, content) {
		this.callId = callId;
		this.content = content;
	}
}
class ThinkingPart {
	constructor(value) {
		this.value = value;
	}
}
const vscodeShim = {
	LanguageModelDataPart: DataPart,
	LanguageModelTextPart: TextPart,
	LanguageModelToolCallPart: ToolCallPart,
	LanguageModelToolResultPart: ToolResultPart,
	LanguageModelThinkingPart: ThinkingPart,
	LanguageModelChatMessageRole: { User: 1, Assistant: 2 },
	window: {
		createOutputChannel: () => ({
			debug() {},
			info() {},
			warn() {},
			error() {},
			dispose() {},
		}),
	},
	workspace: {
		getConfiguration: () => ({ get: (_key, fallback) => fallback }),
	},
};
Module._load = function (request, parent, isMain) {
	if (request === "vscode") {
		return vscodeShim;
	}
	return originalLoad.call(this, request, parent, isMain);
};

try {
	const { logger } = require("../out/logger.js");
	logger.init();
	const { AnthropicApi } = require("../out/anthropic/anthropicApi.js");

	// Scenario from issue #87: one assistant turn issued 3 parallel tool_use
	// calls; VS Code delivers the 3 results as 3 separate user messages.
	const messages = [
		{ role: 3, content: [new TextPart("System prompt")] },
		{ role: 1, content: [new TextPart("env info")] },
		{
			role: 2,
			content: [
				new ThinkingPart("Let me read the files."),
				new TextPart("I'll inspect the project."),
				new ToolCallPart("call_1", "read_file", {
					filePath: "/a",
					startLine: 1,
					endLine: 50,
				}),
				new ToolCallPart("call_2", "read_file", {
					filePath: "/b",
					startLine: 1,
					endLine: 100,
				}),
				new ToolCallPart("call_3", "read_file", {
					filePath: "/c",
					startLine: 1,
					endLine: 100,
				}),
			],
		},
		{ role: 1, content: [new ToolResultPart("call_1", "content of a")] },
		{ role: 1, content: [new ToolResultPart("call_2", "content of b")] },
		{ role: 1, content: [new ToolResultPart("call_3", "content of c")] },
		{ role: 1, content: [new TextPart("Now analyze these files.")] },
	];

	const api = new AnthropicApi("deepseek-v4-flash");
	const out = await api.convertMessages(messages, {
		includeReasoningInRequest: true,
		vision: false,
	});

	// system is extracted to _systemContent, so only 4 messages remain
	assert.equal(
		out.length,
		4,
		"expect 4 messages: user, assistant, merged user, user",
	);
	assert.equal(out[0].role, "user");
	assert.equal(out[1].role, "assistant");
	assert.equal(out[1].content.length, 5, "thinking + text + 3 tool_use");
	assert.equal(
		out[2].role,
		"user",
		"tool results merged into a single user message",
	);
	const trs = out[2].content;
	assert.equal(trs.length, 3, "3 tool_result blocks in one user message");
	assert.deepEqual(
		trs.map((t) => t.tool_use_id),
		["call_1", "call_2", "call_3"],
	);
	assert.ok(trs.every((t) => t.type === "tool_result"));
	assert.equal(out[3].role, "user");
	assert.equal(out[3].content[0].text, "Now analyze these files.");

	// Single tool result stays a single user message (unchanged behavior)
	const single = await new AnthropicApi("test").convertMessages(
		[
			{
				role: 2,
				content: [new ToolCallPart("call_x", "read_file", { filePath: "/a" })],
			},
			{ role: 1, content: [new ToolResultPart("call_x", "result")] },
		],
		{ includeReasoningInRequest: true, vision: false },
	);
	assert.equal(single.length, 2);
	assert.equal(single[1].role, "user");
	assert.equal(single[1].content.length, 1);
	assert.equal(single[1].content[0].tool_use_id, "call_x");

	// A user message mixing text + tool result must not be buffered
	const mixed = await new AnthropicApi("test").convertMessages(
		[
			{
				role: 2,
				content: [new ToolCallPart("call_y", "read_file", { filePath: "/a" })],
			},
			{
				role: 1,
				content: [
					new TextPart("keep going"),
					new ToolResultPart("call_y", "result"),
				],
			},
		],
		{ includeReasoningInRequest: true, vision: false },
	);
	assert.equal(mixed.length, 2);
	assert.equal(mixed[1].content.length, 2);
	assert.ok(mixed[1].content.some((c) => c.type === "tool_result"));
	assert.ok(mixed[1].content.some((c) => c.type === "text"));

	console.log("anthropic tool-result merge: ok");
} finally {
	Module._load = originalLoad;
}
