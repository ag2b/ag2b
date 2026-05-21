export type OpenAiSystemMessage = {
  role: 'system';
  content: string;
};

export type OpenAiUserMessage = {
  role: 'user';
  content: string;
};

export type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    /**
     * JSON string, must JSON.stringify on send, JSON.parse on receive
     */
    arguments: string;
  };
};

export type OpenAiAssistantMessage = {
  role: 'assistant';
  content: string | null;
  reasoning_content?: string | null;
  tool_calls?: OpenAiToolCall[];
};

export type OpenAiToolMessage = {
  role: 'tool';
  tool_call_id: string;
  content: string;
};

export type OpenAiMessage =
  | OpenAiSystemMessage
  | OpenAiUserMessage
  | OpenAiAssistantMessage
  | OpenAiToolMessage;

export type OpenAiTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    /**
     * JSON Schema from tool.schema
     */
    parameters: Record<string, unknown>;
  };
};

export type OpenAiResponse = {
  id: string;
  object: 'chat.completion';
  model: string;
  choices: OpenAiChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type OpenAiFinishReason = 'stop' | 'tool_calls' | 'length' | 'content_filter' | undefined;

export type OpenAiChoice = {
  index: number;
  message: OpenAiAssistantMessage;
  finish_reason: OpenAiFinishReason;
};

export type OpenAiStreamDelta = {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: {
    index: number;
    id?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }[];
};

export type OpenAiStreamChunk = {
  id: string;
  choices: {
    index: number;
    delta: OpenAiStreamDelta;
    finish_reason: OpenAiFinishReason | null;
  }[];
};
