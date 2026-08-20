/** OpenAI Responses API request and streaming types used by the adapter. */

export interface ResponsesInputText {
    type: "input_text";
    text: string;
}

export interface ResponsesInputImage {
    type: "input_image";
    image_url: string;
}

export type ResponsesInputContent = ResponsesInputText | ResponsesInputImage;

export interface ResponsesOutputText {
    type: "output_text";
    text: string;
}

export interface ResponsesReasoningSummaryText {
    type: "summary_text";
    text: string;
}

export interface ResponsesReasoningItem {
    type: "reasoning";
    id?: string;
    summary: ResponsesReasoningSummaryText[];
    encrypted_content?: string | null;
}

export interface ResponsesFunctionCallItem {
    type: "function_call";
    id?: string;
    call_id: string;
    name: string;
    arguments: string;
}

export interface ResponsesFunctionCallOutputItem {
    type: "function_call_output";
    call_id: string;
    output: string | ResponsesInputContent[];
}

export type ResponsesInputItem =
    | { role: "system"; content: string }
    | { role: "user"; content: ResponsesInputContent[] }
    | { role: "assistant"; content: ResponsesOutputText[] }
    | ResponsesReasoningItem
    | ResponsesFunctionCallItem
    | ResponsesFunctionCallOutputItem;

export interface ResponsesFunctionToolDef {
    type: "function";
    name: string;
    description?: string;
    parameters: object;
    strict: boolean;
}

export interface ResponsesRequestBody {
    model: string;
    input: ResponsesInputItem[];
    stream: true;
    store?: boolean;
    max_output_tokens?: number;
    temperature?: number;
    top_p?: number;
    reasoning?: {
        effort?: string;
        summary?: "auto" | "concise" | "detailed";
    };
    include?: string[];
    tools?: ResponsesFunctionToolDef[];
    tool_choice?: string | Record<string, unknown>;
    instructions?: string;
    text?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface ResponsesUsage {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: {
        cached_tokens?: number;
    };
    output_tokens_details?: {
        reasoning_tokens?: number;
    };
}

export interface ResponsesStreamItem {
    type?: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    summary?: ResponsesReasoningSummaryText[];
    encrypted_content?: string | null;
}

export interface ResponsesStreamEvent {
    type: string;
    sequence_number?: number;
    output_index?: number;
    content_index?: number;
    summary_index?: number;
    item_id?: string;
    delta?: string;
    text?: string;
    item?: ResponsesStreamItem;
    code?: string;
    message?: string;
    response?: {
        id?: string;
        status?: string;
        usage?: ResponsesUsage;
        incomplete_details?: { reason?: string } | null;
        error?: { code?: string; message?: string } | null;
    };
}
