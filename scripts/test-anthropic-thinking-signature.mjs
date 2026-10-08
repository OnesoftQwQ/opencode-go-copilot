/**
 * Regression checks for Anthropic signed thinking blocks (issue #137 follow-up).
 *
 * Claude 5.x rejects replayed thinking blocks that omit `signature`
 * (`messages.N.content.M.thinking.signature: Field required`). The VS Code
 * `LanguageModelThinkingPart` round-trip carries only text, so signatures are
 * persisted in a dedicated DataPart and replayed verbatim; unsigned thinking
 * text must never be sent back.
 */
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
class ThinkingPart {
    constructor(value, id, metadata) {
        this.value = value;
        this.id = id;
        this.metadata = metadata;
    }
}
class ToolCallPart { }
class ToolResultPart { }

const vscodeShim = {
    LanguageModelDataPart: DataPart,
    LanguageModelTextPart: TextPart,
    LanguageModelThinkingPart: ThinkingPart,
    LanguageModelToolCallPart: ToolCallPart,
    LanguageModelToolResultPart: ToolResultPart,
    LanguageModelChatMessageRole: { User: 1, Assistant: 2 },
    workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) },
};

Module._load = function (request, parent, isMain) {
    if (request === "vscode") {
        return vscodeShim;
    }
    return originalLoad.call(this, request, parent, isMain);
};

try {
    const {
        serializeThinkingSignature,
        deserializeThinkingSignature,
        createThinkingSignaturePart,
        parseThinkingSignaturePart,
        ANTHROPIC_THINKING_SIGNATURE_MIME,
    } = require("../out/anthropic/thinkingSignature.js");
    const { AnthropicApi } = require("../out/anthropic/anthropicApi.js");

    const entry = { thinking: "Let me work through this step by step.", signature: "sig-abc123" };

    // Codec round-trip and validation.
    assert.deepEqual(deserializeThinkingSignature(serializeThinkingSignature(entry)), entry);
    assert.equal(deserializeThinkingSignature(new TextEncoder().encode("not-json")), null);
    assert.equal(
        deserializeThinkingSignature(new TextEncoder().encode(JSON.stringify({ version: 1, thinking: "x", signature: "" }))),
        null
    );

    // DataPart wrapper round-trip.
    const part = createThinkingSignaturePart(entry);
    assert.equal(part.mimeType, ANTHROPIC_THINKING_SIGNATURE_MIME);
    assert.deepEqual(parseThinkingSignaturePart(part), entry);
    assert.equal(
        parseThinkingSignaturePart(new DataPart(new TextEncoder().encode("{}"), "application/octet-stream")),
        null
    );

    // A signed thinking block is replayed first, with its signature attached.
    const assistantWithSignature = {
        role: 2,
        content: [new TextPart("The answer is 4."), part],
    };
    const converted = await new AnthropicApi("test").convertMessages(
        [
            { role: 1, content: [new TextPart("What is 2+2?")] },
            assistantWithSignature,
            { role: 1, content: [new TextPart("Thanks")] },
        ],
        { includeReasoningInRequest: true, vision: false }
    );
    assert.deepEqual(converted[1], {
        role: "assistant",
        content: [
            { type: "thinking", thinking: entry.thinking, signature: entry.signature },
            { type: "text", text: "The answer is 4." },
        ],
    });

    // Plain thinking text (no signature) must NOT be replayed — Claude 5.x
    // rejects unsigned thinking blocks with `thinking.signature: Field required`.
    const unsigned = await new AnthropicApi("test").convertMessages(
        [{ role: 2, content: [new TextPart("The answer is 4."), new ThinkingPart("Let me think...")] }],
        { includeReasoningInRequest: true, vision: false }
    );
    assert.deepEqual(unsigned[0], {
        role: "assistant",
        content: [{ type: "text", text: "The answer is 4." }],
    });

    // includeReasoningInRequest=false drops even signed blocks.
    const disabled = await new AnthropicApi("test").convertMessages([assistantWithSignature], {
        includeReasoningInRequest: false,
        vision: false,
    });
    assert.deepEqual(disabled[0], {
        role: "assistant",
        content: [{ type: "text", text: "The answer is 4." }],
    });

    console.log("anthropic thinking signature: ok");
} finally {
    Module._load = originalLoad;
}
