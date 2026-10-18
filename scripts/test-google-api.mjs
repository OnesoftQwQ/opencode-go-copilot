/**
 * Focused checks for the Google Gemini (generateContent) protocol adapter.
 *
 * Covers catalog -> base URL/apiMode resolution, message conversion,
 * request-body construction, SSE parsing (text/thinking/functionCall/usage),
 * ask_image interception and the Git-commit text stream.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
const originalFetch = globalThis.fetch;

class DataPart {
    constructor(data, mimeType) {
        this.data = data;
        if (mimeType !== undefined) this.mimeType = mimeType;
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
    LanguageModelChatToolMode: { Auto: 1, Required: 2 },
    extensions: { getExtension: () => undefined },
    version: "test",
    env: { language: "en", appRoot: "/nonexistent" },
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
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoded);
            controller.close();
        },
    });
};

const token = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose() {} }),
};

try {
    const { logger } = require("../out/logger.js");
    logger.init();
    const { clearModelsDevCache, ensureModelsDevLoaded } = require("../out/modelsDev.js");
    const { getCatalogModelConfig, buildCatalogModelInfo } = require("../out/catalogModels.js");
    const { GoogleApi, buildGoogleThinkingConfig } = require("../out/google/googleApi.js");
    const { SKIP_THOUGHT_SIGNATURE_VALIDATOR } = require("../out/google/googleTypes.js");

    // ── Catalog resolution: model-level provider.api wins ──
    const catalog = {
        models: {},
        providers: {
            "opencode-go": {
                id: "opencode-go",
                api: "https://example.test/inference/go/openai/v1/",
                npm: "@ai-sdk/openai-compatible",
                name: "OpenCode Go",
                models: {
                    "gemini-4-argon-contributor": {
                        id: "gemini-4-argon-contributor",
                        name: "Gemini 4 Argon Contributor",
                        family: "gemini",
                        reasoning: true,
                        reasoning_options: [{ type: "effort", values: ["low", "medium", "high"] }],
                        tool_call: true,
                        attachment: true,
                        temperature: false,
                        limit: { context: 1048576, output: 65536 },
                        provider: {
                            npm: "@ai-sdk/google",
                            api: "https://example.test/inference/go/google/v1beta",
                        },
                    },
                },
            },
        },
    };
    globalThis.fetch = async (url) => {
        assert.equal(String(url), "https://models.dev/catalog.json");
        return new Response(JSON.stringify(catalog), { status: 200 });
    };

    clearModelsDevCache();
    await ensureModelsDevLoaded();

    const geminiConfig = getCatalogModelConfig("gemini-4-argon-contributor");
    assert.equal(geminiConfig.apiMode, "google");
    assert.equal(geminiConfig.baseUrl, "https://example.test/inference/go/google/v1beta/");
    assert.equal(geminiConfig.thinkingMode, "always");
    assert.equal(geminiConfig.supportsTemperature, false);
    assert.equal(geminiConfig.max_completion_tokens, 65536);

    const geminiInfo = buildCatalogModelInfo("opencode-go", "gemini-4-argon-contributor");
    const effortSchema = geminiInfo.configurationSchema.properties.reasoningEffort;
    assert.deepEqual(effortSchema.enum, ["low", "medium", "high"]);
    assert.equal(effortSchema.default, "medium");

    // ── Message conversion ──
    const api = new GoogleApi("gemini-4-argon-contributor");
    const contents = await api.convertMessages(
        [
            { role: 3, content: [new TextPart("System rules")] },
            { role: 1, content: [new TextPart("Inspect this"), new DataPart(new Uint8Array([1, 2]), "image/png")] },
            {
                role: 2,
                content: [
                    new ThinkingPart("Check the file"),
                    new TextPart("I will read it."),
                    new ToolCallPart("call_read", "read_file", { filePath: "/tmp/a" }),
                ],
            },
            { role: 1, content: [new ToolResultPart("call_read", [new TextPart("file contents")])] },
        ],
        { includeReasoningInRequest: true, vision: true },
    );

    assert.deepEqual(contents[0], {
        role: "user",
        parts: [
            { text: "Inspect this" },
            { inlineData: { mimeType: "image/png", data: "AQI=" } },
        ],
    });
    assert.deepEqual(contents[1], {
        role: "model",
        parts: [
            { text: "Check the file", thought: true },
            { text: "I will read it." },
            {
                functionCall: { id: "call_read", name: "read_file", args: { filePath: "/tmp/a" } },
                thoughtSignature: SKIP_THOUGHT_SIGNATURE_VALIDATOR,
            },
        ],
    });
    assert.deepEqual(contents[2], {
        role: "user",
        parts: [
            {
                functionResponse: {
                    id: "call_read",
                    name: "read_file",
                    response: { name: "read_file", content: "file contents" },
                },
            },
        ],
    });

    // ── Request body ──
    const body = api.prepareRequestBody(
        { contents },
        {
            id: "gemini-4-argon-contributor",
            owned_by: "opencode",
            supportsTemperature: false,
            temperature: 1,
            top_p: 0.9,
            top_k: 40,
            max_completion_tokens: 2048,
            reasoning_effort: "high",
            enable_thinking: true,
        },
        {
            tools: [{ name: "read_file", description: "Read a file", inputSchema: { type: "object" } }],
            toolMode: vscodeShim.LanguageModelChatToolMode.Required,
        },
    );
    assert.equal("temperature" in body.generationConfig, false);
    assert.equal(body.generationConfig.topP, 0.9);
    assert.equal(body.generationConfig.topK, 40);
    assert.equal(body.generationConfig.maxOutputTokens, 2048);
    assert.deepEqual(body.generationConfig.thinkingConfig, {
        thinkingLevel: "high",
        includeThoughts: true,
    });
    assert.deepEqual(body.systemInstruction, { parts: [{ text: "System rules" }] });
    assert.deepEqual(body.tools?.[0]?.functionDeclarations?.[0], {
        name: "read_file",
        description: "Read a file",
        parametersJsonSchema: { type: "object" },
    });
    assert.deepEqual(body.toolConfig, { functionCallingConfig: { mode: "ANY" } });

    assert.deepEqual(buildGoogleThinkingConfig(undefined), { includeThoughts: true });
    assert.deepEqual(buildGoogleThinkingConfig({ owned_by: "opencode", enable_thinking: false }), {
        includeThoughts: false,
    });
    assert.deepEqual(buildGoogleThinkingConfig({ owned_by: "opencode", reasoning_effort: "max" }), {
        thinkingLevel: "high",
        includeThoughts: true,
    });

    // ── Non-vision vision-proxy path ──
    const proxyApi = new GoogleApi("text-model");
    const proxyContents = await proxyApi.convertMessages(
        [{ role: 1, content: [new TextPart("What is this?"), new DataPart(new Uint8Array([9]), "image/png")] }],
        { includeReasoningInRequest: false, vision: false },
    );
    assert.match(proxyContents[0].parts[0].text, /imageIndex=0/);
    const proxyBody = proxyApi.prepareRequestBody({ contents: proxyContents }, { id: "text-model", owned_by: "opencode" });
    const declarationNames = proxyBody.tools?.[0]?.functionDeclarations?.map((decl) => decl.name) ?? [];
    assert.deepEqual(declarationNames, ["ask_image"]);
    assert.equal(proxyBody.toolConfig.functionCallingConfig.mode, "AUTO");

    // ── Streaming: thoughts, text, functionCall, usage ──
    const streamed = [];
    let usage;
    api.onUsage = (value) => {
        usage = value;
    };
    await api.processStreamingResponse(
        makeStream([
            { candidates: [{ content: { parts: [{ text: "Checking", thought: true }], role: "model" } }] },
            { candidates: [{ content: { parts: [{ text: "Done" }], role: "model" } }] },
            {
                candidates: [{
                    content: {
                        parts: [{ functionCall: { id: "call_1", name: "read_file", args: { filePath: "/tmp/a" } } }],
                        role: "model",
                    },
                }],
            },
            {
                candidates: [{ finishReason: "STOP" }],
                usageMetadata: {
                    promptTokenCount: 10,
                    candidatesTokenCount: 3,
                    thoughtsTokenCount: 2,
                    cachedContentTokenCount: 4,
                },
            },
        ]),
        { report: (part) => streamed.push(part) },
        token,
    );

    // A single space is emitted before the first tool call (same hint as the
    // OpenAI adapter), so compare only the meaningful text.
    const textValues = streamed
        .filter((part) => part instanceof TextPart)
        .map((part) => part.value)
        .filter((value) => value.trim().length > 0);
    assert.deepEqual(textValues, ["Done"]);
    const toolParts = streamed.filter((part) => part instanceof ToolCallPart);
    assert.equal(toolParts.length, 1);
    assert.equal(toolParts[0].callId, "call_1");
    assert.deepEqual(toolParts[0].input, { filePath: "/tmp/a" });
    assert.deepEqual(usage, {
        promptTokens: 10,
        completionTokens: 5,
        cacheHitTokens: 4,
        cacheMissTokens: 6,
    });

    // ── ask_image interception ──
    const interceptApi = new GoogleApi("text-model");
    const intercepted = [];
    await interceptApi.processStreamingResponse(
        makeStream([
            {
                candidates: [{
                    content: {
                        parts: [{ functionCall: { id: "call_img", name: "ask_image", args: { imageIndex: 0, query: "what?" } } }],
                        role: "model",
                    },
                }],
            },
        ]),
        { report: (part) => intercepted.push(part) },
        token,
    );
    assert.equal(intercepted.length, 0);
    assert.deepEqual(interceptApi.interceptedToolCall, {
        id: "call_img",
        name: "ask_image",
        args: { imageIndex: 0, query: "what?" },
    });

    // ── Git commit stream ──
    let capturedRequest;
    globalThis.fetch = async (url, init) => {
        capturedRequest = { url: String(url), init };
        return new Response(
            makeStream([
                { candidates: [{ content: { parts: [{ text: "feat: " }] } }] },
                { candidates: [{ content: { parts: [{ text: "support google" }] } }] },
                { candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 } },
            ]),
            { status: 200 },
        );
    };
    const chunks = [];
    for await (const chunk of new GoogleApi("gemini-4-argon-contributor").createMessage(
        {
            id: "gemini-4-argon-contributor",
            owned_by: "opencode",
            apiMode: "google",
            enable_thinking: false,
            max_completion_tokens: 8192,
        },
        "Generate one commit subject.",
        [{ role: "user", content: "diff --git a/a b/a" }],
        "https://example.test/inference/go/google/v1beta",
        "test-token",
    )) {
        chunks.push(chunk.text);
    }
    assert.deepEqual(chunks, ["feat: ", "support google"]);
    assert.equal(
        capturedRequest.url,
        "https://example.test/inference/go/google/v1beta/models/gemini-4-argon-contributor:streamGenerateContent?alt=sse",
    );
    assert.equal(capturedRequest.init.headers.Authorization, "Bearer test-token");
    assert.ok(capturedRequest.init.headers["x-opencode-session"]);
    const commitBody = JSON.parse(capturedRequest.init.body);
    assert.deepEqual(commitBody.systemInstruction, { parts: [{ text: "Generate one commit subject." }] });
    assert.deepEqual(commitBody.contents, [
        { role: "user", parts: [{ text: "diff --git a/a b/a" }] },
    ]);
    assert.equal(commitBody.generationConfig.maxOutputTokens, 8192);
    assert.deepEqual(commitBody.generationConfig.thinkingConfig, { includeThoughts: false });

    console.log("google api: ok");
} finally {
    Module._load = originalLoad;
    globalThis.fetch = originalFetch;
}
