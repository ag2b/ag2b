import type { AssistantToolCall } from '@/messages';

import type { AgentResponse } from './agent';

/**
 * Fires once at the very start of `agent.chat` / `agent.chatStream`, before the user
 * message is appended to history and before the iteration loop begins.
 */
export type AgentChatStart = {
  type: 'agent_chat_start';
  /** Raw user message string passed to `agent.chat(message, ...)`. */
  message: string;
};

/**
 * Fires once when the chat completes successfully. Terminal event — mutually exclusive
 * with {@link AgentChatAbort} and {@link AgentChatError}.
 */
export type AgentChatDone = {
  type: 'agent_chat_done';
  /** Final agent response with content and finish reason. */
  response: AgentResponse;
};

/**
 * Fires when the chat is cancelled via abort signal. Terminal event — mutually exclusive
 * with {@link AgentChatDone} and {@link AgentChatError}.
 */
export type AgentChatAbort = {
  type: 'agent_chat_abort';
  /** Value of `signal.reason` at the time of abort. `DOMException("AbortError")` by default. */
  reason?: unknown;
};

/**
 * Fires when the chat ends with a non-abort error (provider error, max iterations,
 * hook throw, etc.). Terminal event — mutually exclusive with {@link AgentChatDone}
 * and {@link AgentChatAbort}.
 */
export type AgentChatError = {
  type: 'agent_chat_error';
  /** The thrown error. Same value that will rethrow to the caller. */
  error: unknown;
};

/**
 * Content text from the assistant. Streamed token-by-token under {@link Agent.chatStream};
 * delivered as a single delta with the full text under {@link Agent.chat} with `onEvent`.
 */
export type AgentContentDelta = {
  type: 'agent_content_delta';
  /** Partial text content (one or more tokens). */
  delta: string;
};

/**
 * Reasoning/thinking text from the assistant. Streamed token-by-token under {@link Agent.chatStream};
 * delivered as a single delta with the full reasoning under {@link Agent.chat} with `onEvent`.
 * Separate channel from {@link AgentContentDelta} so UIs can render a "thinking…" view
 * without mixing it into the visible reply.
 */
export type AgentReasoningDelta = {
  type: 'agent_reasoning_delta';
  /** Partial reasoning text (one or more tokens). */
  delta: string;
};

/**
 * Boundary signal: the reasoning stream for the current turn is final. Fires once per
 * loop iteration that produced any reasoning, emitted just before the first non-reasoning
 * event (content delta, tool call, or end of stream) so consumers can flush the thinking
 * view before the visible reply starts.
 */
export type AgentReasoningEnd = {
  type: 'agent_reasoning_end';
};

/**
 * Boundary signal: the assistant message for the current loop iteration has just been
 * committed to history. The text stream for this turn is final.
 *
 * Pairs with {@link AgentContentDelta}. Fires once per loop iteration — before the
 * iteration's tool calls (if any), and before {@link AgentChatDone} on the final
 * iteration. Fires even when the turn was tool-call-only (no text produced).
 */
export type AgentContentEnd = {
  type: 'agent_content_end';
};

/** Emitted when a tool call is about to execute. */
export type AgentToolCallStart = {
  type: 'agent_tool_call_start';

  /** The tool call being executed. */
  call: AssistantToolCall;
};

/** Emitted when a tool call has finished executing successfully. */
export type AgentToolCallResult = {
  type: 'agent_tool_call_result';
  /** The tool call being executed. */
  call: AssistantToolCall;
  /** Return value from the tool handler. */
  result: unknown;
};

/** Emitted when a tool call threw an error (execution failure, not business logic error). */
export type AgentToolCallError = {
  type: 'agent_tool_call_error';
  /** The tool call being executed. */
  call: AssistantToolCall;
  /** The thrown error. Could be any shape. */
  error: unknown;
};

/** Union of all events emitted by {@link Agent.chat} (when `onEvent` is provided) and {@link Agent.chatStream}. */
export type AgentEvent =
  | AgentChatStart
  | AgentChatDone
  | AgentChatAbort
  | AgentChatError
  | AgentContentDelta
  | AgentContentEnd
  | AgentReasoningDelta
  | AgentReasoningEnd
  | AgentToolCallStart
  | AgentToolCallResult
  | AgentToolCallError;
