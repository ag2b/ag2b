export type AnthropicTextBlock = {
  type: 'text';
  text: string;
};

export type AnthropicToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  /**
   * Parsed arguments object (non-streaming response only).
   * In streaming, args arrive via `input_json_delta` events as a partial JSON string.
   */
  input: Record<string, unknown>;
};

export type AnthropicToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
};

/** Extended-thinking block: opaque reasoning text with a signature for echo-back. */
export type AnthropicThinkingBlock = {
  type: 'thinking';
  thinking: string;
  signature: string;
};

/** Incremental thinking text delta in streaming content_block_delta events. */
export type AnthropicThinkingDelta = {
  type: 'thinking_delta';
  thinking: string;
};

/** Final signature for a thinking block in streaming content_block_delta events. */
export type AnthropicSignatureDelta = {
  type: 'signature_delta';
  signature: string;
};

export type AnthropicUserMessage = {
  role: 'user';
  content: string | (AnthropicTextBlock | AnthropicToolResultBlock)[];
};

export type AnthropicAssistantMessage = {
  role: 'assistant';
  content: string | (AnthropicTextBlock | AnthropicToolUseBlock | AnthropicThinkingBlock)[];
};

export type AnthropicMessage = AnthropicUserMessage | AnthropicAssistantMessage;

export type AnthropicTool = {
  name: string;
  description: string;
  /**
   * JSON Schema from tool.schema
   */
  input_schema: Record<string, unknown>;
};

export type AnthropicStopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;

export type AnthropicResponse = {
  id: string;
  type: 'message';
  role: 'assistant';
  content: (AnthropicTextBlock | AnthropicToolUseBlock | AnthropicThinkingBlock)[];
  model: string;
  stop_reason: AnthropicStopReason;
  stop_sequence: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
};

export type AnthropicStreamMessageStart = {
  type: 'message_start';
  message: AnthropicResponse;
};

export type AnthropicStreamContentBlockStart = {
  type: 'content_block_start';
  index: number;
  content_block: AnthropicTextBlock | AnthropicToolUseBlock | AnthropicThinkingBlock;
};

export type AnthropicStreamTextDelta = {
  type: 'text_delta';
  text: string;
};

export type AnthropicStreamInputJsonDelta = {
  type: 'input_json_delta';
  partial_json: string;
};

export type AnthropicStreamContentBlockDelta = {
  type: 'content_block_delta';
  index: number;
  delta:
    | AnthropicStreamTextDelta
    | AnthropicStreamInputJsonDelta
    | AnthropicThinkingDelta
    | AnthropicSignatureDelta;
};

export type AnthropicStreamContentBlockStop = {
  type: 'content_block_stop';
  index: number;
};

export type AnthropicStreamMessageDelta = {
  type: 'message_delta';
  delta: {
    stop_reason: AnthropicStopReason;
    stop_sequence: string | null;
  };
  usage?: {
    output_tokens: number;
  };
};

export type AnthropicStreamMessageStop = {
  type: 'message_stop';
};

export type AnthropicStreamPing = {
  type: 'ping';
};

export type AnthropicStreamError = {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
};

export type AnthropicStreamEvent =
  | AnthropicStreamMessageStart
  | AnthropicStreamContentBlockStart
  | AnthropicStreamContentBlockDelta
  | AnthropicStreamContentBlockStop
  | AnthropicStreamMessageDelta
  | AnthropicStreamMessageStop
  | AnthropicStreamPing
  | AnthropicStreamError;
