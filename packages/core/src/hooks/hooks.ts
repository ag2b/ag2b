import type { AgentResponse } from '@/agent';
import type { AssistantToolCall, ChatMessage } from '@/messages';
import type { ProviderRequest, ProviderResponse } from '@/provider';
import type { Scope } from '@/scope';
import type { Tool } from '@/tool';
import type { Awaitable } from '@/types';

/**
 * Context for the {@link AgentHooks.onChatStart} observer.
 */
export type OnChatStartCtx = {
  /** Raw user message string passed to `agent.chat(message, ...)`. */
  readonly message: string;
  /** Optional abort signal forwarded by the caller. */
  readonly signal?: AbortSignal;
};

/**
 * Context for the {@link AgentHooks.onChatDone} observer.
 */
export type OnChatDoneCtx = {
  /** Final response that will be returned from `agent.chat`. */
  readonly response: AgentResponse;
};

/**
 * Context for the {@link AgentHooks.onChatAbort} observer.
 */
export type OnChatAbortCtx = {
  /** Value of `signal.reason` at the time of abort. `DOMException("AbortError")` by default. */
  readonly reason?: unknown;
};

/**
 * Context for the {@link AgentHooks.onChatError} observer.
 */
export type OnChatErrorCtx = {
  /** Error that ended the chat. Does not include abort errors — those route to {@link AgentHooks.onChatAbort}. */
  readonly error: unknown;
};

/**
 * Context for the {@link AgentHooks.onMessage} observer.
 */
export type OnMessageCtx = {
  /** The message just appended to history (discriminated by `role`). */
  readonly message: ChatMessage;
};

/**
 * Context for the {@link AgentHooks.onScopeRegister} observer.
 */
export type OnScopeRegisterCtx = {
  /** Scope that was just registered. */
  readonly scope: Scope;
};

/**
 * Context for the {@link AgentHooks.onScopeUnregister} observer.
 */
export type OnScopeUnregisterCtx = {
  /** Scope that was just removed. */
  readonly scope: Scope;
};

/**
 * Context for the {@link AgentHooks.preRequest} interceptor.
 */
export type PreRequestCtx = {
  /** Iteration index, **0-indexed** — `0` for the first turn. */
  readonly iteration: number;
  /** Request as it stands so far. May reflect prior hooks' modifications. */
  readonly request: ProviderRequest;
  /** Optional abort signal forwarded by the caller. */
  readonly signal?: AbortSignal;
};

/**
 * Context for the {@link AgentHooks.preToolCall} interceptor.
 */
export type PreToolCallCtx = {
  /** Tool call as requested by the LLM. */
  readonly call: AssistantToolCall;
  /** Resolved tool definition. */
  readonly tool: Tool;
  /** Owning scope. */
  readonly scope: Scope;
};

/**
 * Context for the {@link AgentHooks.onResponse} interceptor.
 */
export type OnResponseCtx = {
  /** Iteration index, **0-indexed** — matches the surrounding `preRequest`. */
  readonly iteration: number;
  /** Final request that was sent (or used by short-circuit). */
  readonly request: ProviderRequest;
  /** Response from the LLM (or the short-circuit value). May reflect prior hooks' modifications. */
  readonly response: ProviderResponse;
  /** Optional abort signal forwarded by the caller. */
  readonly signal?: AbortSignal;
};

/**
 * Context for the {@link AgentHooks.onToolCallResult} interceptor.
 */
export type OnToolCallResultCtx = {
  /** Original tool call. */
  readonly call: AssistantToolCall;
  /** Resolved tool. */
  readonly tool: Tool;
  /** Owning scope. */
  readonly scope: Scope;
  /** Raw return value from the tool handler (or short-circuit). */
  readonly result: unknown;
};

/**
 * Context for the {@link AgentHooks.onToolCallError} interceptor.
 */
export type OnToolCallErrorCtx = {
  /** Original tool call. */
  readonly call: AssistantToolCall;
  /** Resolved tool. Absent when the error is `Ag2bUnknownToolError`. */
  readonly tool?: Tool;
  /** Owning scope. Absent when the error is `Ag2bUnknownToolError`. */
  readonly scope?: Scope;
  /** Error thrown / supplied. May reflect prior hooks' modifications. */
  readonly error: unknown;
};

/**
 * Return type for the {@link AgentHooks.preRequest} interceptor.
 *
 * - `void` — continue normally.
 * - `{ request }` — use this modified request for the provider call.
 * - `{ response }` — skip the provider call, use this response.
 */
export type PreRequestReturn =
  | void
  | { request: ProviderRequest; response?: never }
  | { request?: never; response: ProviderResponse };

/**
 * Return type for the {@link AgentHooks.preToolCall} interceptor.
 *
 * - `void` — continue, run the handler.
 * - `{ call }` — run the handler with this modified call.
 * - `{ result }` — skip the handler, treat the tool as having returned this.
 * - `{ error }` — skip the handler, treat the tool as having thrown this.
 */
export type PreToolCallReturn =
  | void
  | { call: AssistantToolCall; result?: never; error?: never }
  | { call?: never; result: unknown; error?: never }
  | { call?: never; result?: never; error: unknown };

/**
 * Return type for the {@link AgentHooks.onResponse} interceptor.
 * `void` keeps the response unchanged; `{ response }` replaces it.
 */
export type OnResponseReturn = void | { response: ProviderResponse };

/**
 * Return type for the {@link AgentHooks.onToolCallResult} interceptor.
 * `void` keeps the result unchanged; `{ result }` replaces it.
 */
export type OnToolCallResultReturn = void | { result: unknown };

/**
 * Return type for the {@link AgentHooks.onToolCallError} interceptor.
 * `void` keeps the error unchanged; `{ error }` replaces it.
 */
export type OnToolCallErrorReturn = void | { error: unknown };

/** The full lifecycle hook map for {@link Agent}. */
export type AgentHooks = {
  /**
   * **Observer**
   *
   * Fires once at the very start of `agent.chat` / `agent.chatStream`,
   * **before** the user message is appended to history and **before**
   * the iteration loop begins.
   */
  onChatStart: (ctx: OnChatStartCtx) => Awaitable<void>;

  /**
   * **Observer**
   *
   * Fires once when the chat completes successfully, **after** the assistant
   * message is in history and **before** the response is returned to
   * the caller. Mutually exclusive with {@link onChatAbort} and
   * {@link onChatError} per chat.
   */
  onChatDone: (ctx: OnChatDoneCtx) => Awaitable<void>;

  /**
   * **Observer**
   *
   * Fires when the chat is cancelled via the abort signal. Mutually exclusive
   * with {@link onChatDone} and {@link onChatError} per chat. Hook throws are
   * caught and ignored so the original abort still propagates.
   */
  onChatAbort: (ctx: OnChatAbortCtx) => Awaitable<void>;

  /**
   * **Observer**
   *
   * Fires when the chat ends with a non-abort error — max iterations exceeded,
   * provider error, or any hook throw (except `onChatError` and `onChatAbort`
   * themselves, whose throws are caught and ignored). Mutually exclusive with
   * {@link onChatDone} and {@link onChatAbort} per chat.
   */
  onChatError: (ctx: OnChatErrorCtx) => Awaitable<void>;

  /**
   * **Observer**
   *
   * Fires after the agent loop pushes a message to history. Three
   * occasions per iteration:
   *  1. Once for the user message at the very start (iteration `0`).
   *  2. Once for the assistant message after each `onResponse`.
   *  3. Once per tool result/error after each `onToolCallResult` / `onToolCallError`.
   */
  onMessage: (ctx: OnMessageCtx) => Awaitable<void>;

  /**
   * **Interceptor**
   *
   * Fires before each provider call, once per iteration. Hooks may
   * modify the outgoing `request` or short-circuit the provider call
   * with a synthetic `response` (e.g. cache hit).
   *
   * Pairs with {@link onResponse}, which fires after the provider
   * returns or after a short-circuit supplies a response.
   */
  preRequest: (ctx: PreRequestCtx) => Awaitable<PreRequestReturn>;

  /**
   * **Interceptor**
   *
   * Fires after the LLM returns (or after a `preRequest` short-circuit
   * supplies a response), **before** the assistant message is appended
   * to history. Hooks may replace the `response` to rewrite content,
   * tool calls, or finishReason before downstream processing.
   *
   */
  onResponse: (ctx: OnResponseCtx) => Awaitable<OnResponseReturn>;

  /**
   * **Interceptor**
   *
   * Fires before each tool handler runs, once per tool call in
   * `response.calls`. Hooks may modify the call args, short-circuit
   * with a synthetic `result` (cache hit), or short-circuit with an
   * `error`.
   *
   * Skipped when the tool is unknown (`Ag2bUnknownToolError`) — that
   * case routes directly to {@link onToolCallError}.
   */
  preToolCall: (ctx: PreToolCallCtx) => Awaitable<PreToolCallReturn>;

  /**
   * **Interceptor**
   *
   * Fires after a tool handler returns successfully (or after a
   * `preToolCall` short-circuit supplies a result), **before** the
   * `ToolMessage` is serialized into history. Hooks may replace the
   * `result` (e.g. redact, transform).
   */
  onToolCallResult: (ctx: OnToolCallResultCtx) => Awaitable<OnToolCallResultReturn>;

  /**
   * **Interceptor**
   *
   * Fires after a tool call errors — handler throw, validation
   * failure, unknown tool, disabled tool, or `preToolCall`
   * short-circuit with `{ error }`. **Before** the error is serialized
   * into the `ToolMessage`. Hooks may replace the `error` (e.g. wrap,
   * rewrite, classify).
   *
   */
  onToolCallError: (ctx: OnToolCallErrorCtx) => Awaitable<OnToolCallErrorReturn>;

  /**
   * **Observer**
   *
   * Fires after `agent.scopes.register(scope)` commits the scope (and
   * its tools) to the registry.
   */
  onScopeRegister: (ctx: OnScopeRegisterCtx) => Awaitable<void>;

  /**
   * **Observer**
   *
   * Fires after `agent.scopes.unregister(name)` removes a scope from
   * the registry.
   */
  onScopeUnregister: (ctx: OnScopeUnregisterCtx) => Awaitable<void>;
};
