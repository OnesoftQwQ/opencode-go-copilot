import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
const originalFetch = globalThis.fetch;

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
    constructor(value, id) {
        this.value = value;
        this.id = id;
    }
}

const vscodeShim = {
    LanguageModelDataPart: DataPart,
    LanguageModelTextPart: TextPart,
    LanguageModelToolCallPart: ToolCallPart,
    LanguageModelToolResultPart: ToolResultPart,
    LanguageModelThinkingPart: ThinkingPart,
    LanguageModelChatMessageRole: { User: 1, Assistant: 2 },
    extensions: { getExtension: () => undefined },
    version: "test",
    workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) },
    window: {
        createOutputChannel: () => ({
            debug() {},
            info() {},
            warn() {},
            error() {},
            dispose() {},
        }),
    },
};

Module._load = function (request, parent, isMain) {
    if (request === "vscode") return vscodeShim;
    return originalLoad.call(this, request, parent, isMain);
};

const makeStream = (events) => {
    const encoded = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
    const split = Math.floor(encoded.length / 2);
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoded.slice(0, split));
            controller.enqueue(encoded.slice(split));
            controller.close();
        },
    });
};

try {
    const { logger } = require("../out/logger.js");
    logger.init();
    const { ResponsesApi } = require("../out/openai/responsesApi.js");
    const { RESPONSES_REASONING_MIME } = require("../out/openai/responsesState.js");

    const api = new ResponsesApi("gpt-5.6-luna");
    const messages = [
        { role: 3, content: [new TextPart("System rules")] },
        { role: 1, content: [new TextPart("Inspect this"), new DataPart(new Uint8Array([1, 2]), "image/png")] },
        {
            role: 2,
            content: [
                new TextPart("I will read it."),
                new ToolCallPart("call_read", "read_file", { filePath: "/tmp/a" }),
            ],
        },
        { role: 1, content: [new ToolResultPart("call_read", [new TextPart("file contents")])] },
    ];
    const input = await api.convertMessages(messages, { includeReasoningInRequest: true, vision: true });
    assert.deepEqual(input[0], { role: "system", content: "System rules" });
    assert.equal(input[1].role, "user");
    assert.deepEqual(input[1].content[0], { type: "input_text", text: "Inspect this" });
    assert.equal(input[1].content[1].type, "input_image");
    assert.deepEqual(input[2], {
        role: "assistant",
        content: [{ type: "output_text", text: "I will read it." }],
    });
    assert.deepEqual(input[3], {
        type: "function_call",
        call_id: "call_read",
        name: "read_file",
        arguments: JSON.stringify({ filePath: "/tmp/a" }),
    });
    assert.deepEqual(input[4], {
        type: "function_call_output",
        call_id: "call_read",
        output: "file contents",
    });

    const body = api.prepareRequestBody(
        { model: "gpt-5.6-luna", input, stream: true, store: false },
        {
            id: "gpt-5.6-luna",
            owned_by: "opencode",
            max_completion_tokens: 2048,
            reasoning_effort: "high",
            enable_thinking: true,
        },
        {
            tools: [{ name: "read_file", description: "Read a file", inputSchema: { type: "object" } }],
            modelOptions: { toolMode: "required" },
        },
    );
    assert.equal(body.max_output_tokens, 2048);
    assert.deepEqual(body.reasoning, { effort: "high", summary: "auto" });
    assert.deepEqual(body.include, ["reasoning.encrypted_content"]);
    assert.deepEqual(body.tools?.[0], {
        type: "function",
        name: "read_file",
        description: "Read a file",
        parameters: { type: "object" },
        strict: false,
    });
    assert.equal(body.tool_choice, "required");

    const noReasoningBody = api.prepareRequestBody(
        { model: "plain-model", input: [], stream: true, store: false },
        {
            id: "plain-model",
            owned_by: "opencode",
            supportsReasoning: false,
            enable_thinking: false,
        },
    );
    assert.equal("reasoning" in noReasoningBody, false);
    assert.equal("include" in noReasoningBody, false);

    // A Responses model that does not declare an off effort value must NOT be
    // sent `reasoning.effort: "none"`; reasoning controls are omitted instead.
    const noNoneEffortBody = api.prepareRequestBody(
        { model: "grok-4.5", input: [], stream: true, store: false },
        {
            id: "grok-4.5",
            owned_by: "opencode",
            supportsReasoning: true,
            supportsDisablingReasoning: false,
            enable_thinking: false,
        },
    );
    assert.equal("reasoning" in noNoneEffortBody, false);
    assert.equal("include" in noNoneEffortBody, false);

    // A Responses model that declares `none`/`disabled` still gets the off
    // effort when thinking is disabled.
    const noneEffortBody = api.prepareRequestBody(
        { model: "gpt-5.6-luna", input: [], stream: true, store: false },
        {
            id: "gpt-5.6-luna",
            owned_by: "opencode",
            supportsReasoning: true,
            supportsDisablingReasoning: true,
            enable_thinking: false,
        },
    );
    assert.deepEqual(noneEffortBody.reasoning, { effort: "none" });

    const streamed = [];
    let usage;
    api.onUsage = (value) => { usage = value; };
    await api.processStreamingResponse(
        makeStream([
            { type: "response.reasoning_summary_text.delta", delta: "Checking" },
            { type: "response.output_text.delta", delta: "Done" },
            {
                type: "response.output_item.added",
                output_index: 1,
                item: { type: "function_call", id: "item_1", call_id: "call_1", name: "read_file", arguments: "" },
            },
            { type: "response.function_call_arguments.delta", output_index: 1, item_id: "item_1", delta: "{\"filePath\":" },
            { type: "response.function_call_arguments.delta", output_index: 1, item_id: "item_1", delta: "\"/tmp/a\"}" },
            {
                type: "response.output_item.done",
                output_index: 1,
                item: { type: "function_call", id: "item_1", call_id: "call_1", name: "read_file", arguments: "{\"filePath\":\"/tmp/a\"}" },
            },
            {
                type: "response.output_item.done",
                output_index: 0,
                item: {
                    type: "reasoning",
                    id: "rs_1",
                    summary: [{ type: "summary_text", text: "Checking" }],
                    encrypted_content: "encrypted-reasoning-state",
                },
            },
            {
                type: "response.completed",
                response: {
                    usage: { input_tokens: 10, output_tokens: 4, input_tokens_details: { cached_tokens: 3 } },
                },
            },
        ]),
        { report: (part) => streamed.push(part) },
        {
            isCancellationRequested: false,
            onCancellationRequested: () => ({ dispose() {} }),
        },
    );

    assert.ok(streamed.some((part) => part instanceof TextPart && part.value === "Done"));
    const toolParts = streamed.filter((part) => part instanceof ToolCallPart);
    assert.equal(toolParts.length, 1, "streamed tool call must be emitted exactly once");
    assert.deepEqual(toolParts[0].input, { filePath: "/tmp/a" });
    assert.deepEqual(usage, {
        promptTokens: 10,
        completionTokens: 4,
        cacheHitTokens: 3,
        cacheMissTokens: 7,
    });

    const reasoningParts = streamed.filter(
        (part) => part instanceof DataPart && part.mimeType === RESPONSES_REASONING_MIME,
    );
    assert.equal(reasoningParts.length, 1, "encrypted reasoning state must be emitted exactly once");
    assert.deepEqual(api.takeCapturedReasoningItems(), [
        {
            type: "reasoning",
            id: "rs_1",
            summary: [{ type: "summary_text", text: "Checking" }],
            encrypted_content: "encrypted-reasoning-state",
        },
    ]);
    assert.deepEqual(api.takeCapturedReasoningItems(), [], "captured reasoning state must be drained");

    const replayed = await new ResponsesApi("gpt-5.6-luna").convertMessages(
        [
            { role: 2, content: [reasoningParts[0], new TextPart("Prior answer")] },
            { role: 1, content: [new TextPart("Continue")] },
        ],
        { includeReasoningInRequest: true, vision: false },
    );
    assert.deepEqual(replayed.slice(0, 2), [
        {
            type: "reasoning",
            id: "rs_1",
            summary: [{ type: "summary_text", text: "Checking" }],
            encrypted_content: "encrypted-reasoning-state",
        },
        { role: "assistant", content: [{ type: "output_text", text: "Prior answer" }] },
    ]);

    let capturedRequest;
    globalThis.fetch = async (url, init) => {
        capturedRequest = { url: String(url), init };
        return new Response(makeStream([
            { type: "response.output_text.delta", delta: "feat: " },
            { type: "response.output_text.delta", delta: "support responses" },
            { type: "response.completed", response: { usage: { input_tokens: 5, output_tokens: 3 } } },
        ]), { status: 200 });
    };
    const commitChunks = [];
    for await (const chunk of new ResponsesApi("gpt-5.6-luna").createMessage(
        {
            id: "gpt-5.6-luna",
            owned_by: "opencode",
            apiMode: "openai-responses",
            supportsDisablingReasoning: true,
            enable_thinking: false,
        },
        "Generate one commit subject.",
        [{ role: "user", content: "diff --git a/a b/a" }],
        "https://example.test/v1/",
        "test-token",
    )) {
        commitChunks.push(chunk.text);
    }
    assert.deepEqual(commitChunks, ["feat: ", "support responses"]);
    assert.equal(capturedRequest.url, "https://example.test/v1/responses");
    assert.equal(capturedRequest.init.headers.Authorization, "Bearer test-token");
    const commitBody = JSON.parse(capturedRequest.init.body);
    assert.equal(commitBody.store, false);
    assert.equal(commitBody.instructions, "Generate one commit subject.");
    assert.deepEqual(commitBody.reasoning, { effort: "none" });
    assert.deepEqual(commitBody.input, [
        { role: "user", content: [{ type: "input_text", text: "diff --git a/a b/a" }] },
    ]);

    console.log("responses api: ok");
} finally {
    Module._load = originalLoad;
    globalThis.fetch = originalFetch;
}
