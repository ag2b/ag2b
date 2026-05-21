/** Indicates why the LLM stopped generating. */
export type FinishReason = 'stop' | 'tool_calls' | 'length';

/** A message sent by the user. */
export type UserMessage = {
  role: 'user';
  content: string;
};

/** A tool invocation requested by the LLM. */
export type AssistantToolCall = {
  /** Unique identifier for this tool call. */
  id: string;
  /** Name of the tool to execute. */
  name: string;
  /** Parsed arguments from the LLM. */
  arguments: Record<string, unknown>;
};

/** A message returned by the assistant. */
export type AssistantMessage = {
  role: 'assistant';
  /** Optional text content of the LLM response. */
  content?: string;
  /** Optional reasoning/thinking trace emitted by the LLM. */
  reasoning?: string;
  /** Tool calls requested by the LLM. */
  calls?: AssistantToolCall[];
  /**
   * Provider-specific data that must survive history persistence.
   * Consumers generally don't read this — it's plumbing for provider serialization.
   */
  metadata?: Record<string, unknown>;
};

/** A message containing the result of a tool execution, sent back to the LLM. */
export type ToolMessage = {
  role: 'tool';
  /** ID of the tool call this result corresponds to. */
  id: string;
  /** JSON-stringified result of the tool handler. */
  content: string;
};

/** Union of all message types in the conversation history. */
export type ChatMessage = UserMessage | AssistantMessage | ToolMessage;

/**
 * Creates a {@link UserMessage}.
 */
export function userMessage(content: string): UserMessage {
  return { role: 'user', content };
}

/**
 * Creates an {@link AssistantMessage}.
 */
export function assistantMessage({
  content,
  metadata,
  reasoning,
  calls,
}: Omit<AssistantMessage, 'role'>): AssistantMessage {
  // Normalize empty/whitespace-only content/reasoning to undefined so tool-call-only turns
  // don't render an empty bubble in UIs. Meaningful content is preserved VERBATIM —
  // trimming would drift from what the stream carried (streamingContent), forcing
  // chat UIs to reconcile the mismatch at the streaming-to-history handoff.
  const normalizedContent = content?.trim() ? content : undefined;
  const normalizedReasoning = reasoning?.trim() ? reasoning : undefined;

  return {
    role: 'assistant',
    content: normalizedContent,
    reasoning: normalizedReasoning,
    metadata,
    calls,
  };
}

/**
 * Creates a {@link ToolMessage}.
 */
export function toolMessage(id: string, content: string): ToolMessage {
  return { role: 'tool', id, content };
}
