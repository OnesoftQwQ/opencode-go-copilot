import assert from "node:assert/strict";
import { createRequire } from "node:module";

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
    workspace: {
        getConfiguration: () => ({ get: (_key, fallback) => fallback }),
    },
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

const token = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose() {} }),
};

function createControlledSseStream() {
    const encoder = new TextEncoder();
    let controller;
    const stream = new ReadableStream({
        start(value) {
            controller = value;
        },
    });
    return {
        stream,
        send(payload) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        },
        sendDone() {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        },
        close() {
            controller.close();
        },
    };
}

function waitForToolCall(parts, startProcessing) {
    let resolveToolCall;
    const toolCallPromise = new Promise((resolve) => {
        resolveToolCall = resolve;
    });
    const processing = startProcessing({
        report(part) {
            parts.push(part);
            if (part instanceof ToolCallPart) resolveToolCall(part);
        },
    });
    return { processing, toolCallPromise };
}

async function expectBeforeTerminal(toolCallPromise, processing, terminal) {
    let processingSettled = false;
    processing.finally(() => {
        processingSettled = true;
    });

    const toolCall = await Promise.race([
        toolCallPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("tool call was not emitted eagerly")), 1000)),
    ]);
    assert.equal(processingSettled, false, "stream must still be active when the tool call is emitted");
    assert.equal(toolCall.name, "read_file");
    assert.deepEqual(toolCall.input, { filePath: "/workspace/a.ts" });
    assert.equal("endLine" in toolCall.input, false, "default readFileLines=0 must not rewrite the call");

    terminal();
    await processing;
}

try {
    const { logger } = require("../out/logger.js");
    logger.init();
    const { OpenaiApi } = require("../out/openai/openaiApi.js");
    const { ResponsesApi } = require("../out/openai/responsesApi.js");

    const hyDefaultBody = new OpenaiApi("hy3").prepareRequestBody(
        { model: "hy3", messages: [], stream: true },
        { id: "hy3", owned_by: "opencode", enable_thinking: true },
    );
    assert.equal("reasoning_effort" in hyDefaultBody, false);
    assert.deepEqual(hyDefaultBody.thinking, { type: "enabled" });

    const hyHighBody = new OpenaiApi("hy3").prepareRequestBody(
        { model: "hy3", messages: [], stream: true },
        { id: "hy3", owned_by: "opencode", enable_thinking: true, reasoning_effort: "high" },
    );
    assert.equal(hyHighBody.reasoning_effort, "high");

    const museDefaultBody = new ResponsesApi("muse-spark-1.2-contributor").prepareRequestBody(
        { model: "muse-spark-1.2-contributor", input: [], stream: true, store: false },
        {
            id: "muse-spark-1.2-contributor",
            owned_by: "opencode",
            supportsReasoning: true,
            enable_thinking: true,
        },
    );
    assert.deepEqual(museDefaultBody.reasoning, { summary: "auto" });
    assert.equal("effort" in museDefaultBody.reasoning, false);

    const museExtraHighBody = new ResponsesApi("muse-spark-1.2-contributor").prepareRequestBody(
        { model: "muse-spark-1.2-contributor", input: [], stream: true, store: false },
        {
            id: "muse-spark-1.2-contributor",
            owned_by: "opencode",
            supportsReasoning: true,
            enable_thinking: true,
            reasoning_effort: "xhigh",
        },
    );
    assert.deepEqual(museExtraHighBody.reasoning, { effort: "xhigh", summary: "auto" });

    {
        const controlled = createControlledSseStream();
        const parts = [];
        const { processing, toolCallPromise } = waitForToolCall(parts, (progress) =>
            new OpenaiApi("hy3").processStreamingResponse(controlled.stream, progress, token),
        );

        controlled.send({
            choices: [{
                delta: {
                    tool_calls: [{
                        index: 0,
                        id: "call_chat_read",
                        type: "function",
                        function: {
                            name: "read_file",
                            arguments: JSON.stringify({ filePath: "/workspace/a.ts" }),
                        },
                    }],
                },
                finish_reason: null,
            }],
        });

        await expectBeforeTerminal(toolCallPromise, processing, () => {
            controlled.sendDone();
            controlled.close();
        });
        assert.equal(parts.filter((part) => part instanceof ToolCallPart).length, 1);
    }

    {
        const controlled = createControlledSseStream();
        const parts = [];
        const { processing, toolCallPromise } = waitForToolCall(parts, (progress) =>
            new ResponsesApi("muse-spark-1.2-contributor").processStreamingResponse(controlled.stream, progress, token),
        );

        controlled.send({
            type: "response.output_item.added",
            output_index: 0,
            item: {
                type: "function_call",
                id: "item_responses_read",
                call_id: "call_responses_read",
                name: "read_file",
                arguments: "",
            },
        });
        controlled.send({
            type: "response.function_call_arguments.delta",
            output_index: 0,
            item_id: "item_responses_read",
            delta: JSON.stringify({ filePath: "/workspace/a.ts" }),
        });

        await expectBeforeTerminal(toolCallPromise, processing, () => {
            controlled.send({
                type: "response.completed",
                response: { usage: { input_tokens: 1, output_tokens: 1 } },
            });
            controlled.close();
        });
        assert.equal(parts.filter((part) => part instanceof ToolCallPart).length, 1);
    }

    console.log("eager tool streaming: ok");
} finally {
    Module._load = originalLoad;
}
