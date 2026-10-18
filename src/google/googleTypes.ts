/**
 * Google Gemini generateContent protocol types (the subset the adapter uses).
 *
 * The OpenCode Go gateway exposes this protocol at the model-level base
 * `https://opencode.ai/inference/go/google/v1beta` and accepts the same
 * request body as the Generative Language API:
 * `POST {base}/models/{model}:streamGenerateContent?alt=sse`.
 */

/** Inline binary payload (images, PDFs, ...) encoded as base64. */
export interface GoogleInlineData {
    mimeType: string;
    data: string;
}

/** Function call emitted by the model. */
export interface GoogleFunctionCall {
    id?: string;
    name: string;
    args?: Record<string, unknown>;
}

/** Function response returned to the model after a tool result. */
export interface GoogleFunctionResponse {
    id?: string;
    name: string;
    response: Record<string, unknown>;
    /** Optional rich parts (e.g. images returned by a tool), supported by Gemini 3+. */
    parts?: GooglePart[];
}

/** One part of a content block. */
export interface GooglePart {
    text?: string;
    /** Marks a text part as the model's internal reasoning. */
    thought?: boolean;
    /**
     * Encrypted reasoning state. Gemini 3+ requires the signature to be
     * replayed with functionCall parts; when unavailable the adapter injects
     * the documented `skip_thought_signature_validator` sentinel.
     */
    thoughtSignature?: string;
    inlineData?: GoogleInlineData;
    functionCall?: GoogleFunctionCall;
    functionResponse?: GoogleFunctionResponse;
}

/** Conversation content. Gemini uses only "user" and "model" roles. */
export interface GoogleContent {
    role: "user" | "model";
    parts: GooglePart[];
}

/** System prompt, carried outside the conversation contents. */
export interface GoogleSystemInstruction {
    parts: GooglePart[];
}

/** Thinking controls. */
export interface GoogleThinkingConfig {
    thinkingBudget?: number;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    includeThoughts?: boolean;
}

/** Generation parameters. */
export interface GoogleGenerationConfig {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    thinkingConfig?: GoogleThinkingConfig;
}

/** Function declaration for tool calling. */
export interface GoogleFunctionDeclaration {
    name: string;
    description?: string;
    /** Raw JSON Schema; mutually exclusive with the OpenAPI `parameters` form. */
    parametersJsonSchema?: Record<string, unknown>;
}

/** Tool wrapper. */
export interface GoogleTool {
    functionDeclarations: GoogleFunctionDeclaration[];
}

/** Tool calling mode. */
export interface GoogleFunctionCallingConfig {
    mode?: "AUTO" | "ANY" | "NONE" | "VALIDATED";
    allowedFunctionNames?: string[];
}

/** Tool configuration. */
export interface GoogleToolConfig {
    functionCallingConfig?: GoogleFunctionCallingConfig;
}

/** Request body for streamGenerateContent. */
export interface GoogleRequestBody {
    contents: GoogleContent[];
    systemInstruction?: GoogleSystemInstruction;
    generationConfig?: GoogleGenerationConfig;
    tools?: GoogleTool[];
    toolConfig?: GoogleToolConfig;
}

/** Token accounting returned by Gemini. */
export interface GoogleUsageMetadata {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
    toolUsePromptTokenCount?: number;
    totalTokenCount?: number;
}

/** One candidate response. */
export interface GoogleCandidate {
    content?: GoogleContent;
    finishReason?: string;
    index?: number;
}

/** Streaming / non-streaming response chunk. */
export interface GoogleGenerateContentResponse {
    candidates?: GoogleCandidate[];
    promptFeedback?: {
        blockReason?: string;
        blockReasonMessage?: string;
    };
    usageMetadata?: GoogleUsageMetadata;
    modelVersion?: string;
}

/**
 * Sentinel documented by Google for replaying a functionCall whose original
 * thoughtSignature is no longer available.
 *
 * @see https://ai.google.dev/gemini-api/docs/thought-signatures
 */
export const SKIP_THOUGHT_SIGNATURE_VALIDATOR = "skip_thought_signature_validator";
