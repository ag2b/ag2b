import type { AssistantToolCall, ChatMessage, FinishReason } from '@/messages';
import type { ScopeContext } from '@/scope';
import type { Tool } from '@/tool';

import { inlineScopeContexts } from './context-injection';

/** Configuration for creating a {@link AbstractProvider}. */
export type ProviderConfig = {
  /**
   * URL path to completions
   * @example '/api/chat'
   * @example 'http://localhost:1234/v1/chat/completions'
   */
  baseURL: string;

  /**
   * Custom fetch implementation for auth headers, CORS proxying, etc.
   * Defaults to `globalThis.fetch` when not provided.
   * @default global fetch
   */
  fetch?: typeof fetch;
};

export type ProviderRequest = {
  /** Conversation history to send to the LLM. */
  messages: ChatMessage[];

  /** Tools available to the LLM. */
  tools: Tool[];

  /** Per-scope context payloads resolved for this turn. */
  contexts: ScopeContext[];

  /** Base system prompt configured on the agent. */
  system?: string;
};

export type ProviderResponse = {
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

  /** Reason the LLM stopped generating. */
  finishReason?: FinishReason;
};

/** Base class for LLM providers. */
export abstract class AbstractProvider {
  protected readonly baseURL: string;
  protected readonly fetch: typeof fetch;

  constructor(config: ProviderConfig) {
    this.baseURL = config.baseURL;
    this.fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Send a chat request to the LLM. Every provider must implement this.
   *
   * @param request - {@link ProviderRequest}
   * @param signal - Optional AbortSignal for cancellation.
   */
  public async chat(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse> {
    const prepared = this.prepareRequest(request);
    return this.runChat(prepared, signal);
  }

  /**
   * Transforms the request before it is sent to the provider. Called by
   * {@link chat} (and the streaming equivalent) — never invoked directly by
   * subclasses or callers.
   *
   * Default behavior: inlines scope contexts into `messages` / `system` via
   * {@link inlineScopeContexts}. `contexts` is left on the returned request
   * as informational metadata — {@link runChat} must not re-inline it.
   *
   * Override to apply provider-specific strategies (e.g. Anthropic
   * `cache_control` blocks). An override owns the full transformation —
   * calling `super.prepareRequest` is optional.
   *
   * Must be a pure transformation — no I/O, no side effects.
   */
  protected prepareRequest(request: ProviderRequest): ProviderRequest {
    const { messages, system } = inlineScopeContexts(
      request.contexts,
      request.messages,
      request.system
    );
    return { ...request, messages, system };
  }

  /**
   * Sends the prepared request to the provider's API and returns a normalized
   * {@link ProviderResponse}. Implemented by every concrete provider.
   *
   * The `request` argument has already been run through {@link prepareRequest},
   * so `messages` / `system` are the source of truth for what gets sent.
   * Implementations must not re-inline `request.contexts` — it's informational
   * (e.g. for logging) unless a custom `prepareRequest` override defines a
   * provider-specific meaning for it.
   *
   * @param request - {@link ProviderRequest}
   * @param signal - Optional AbortSignal for cancellation.
   */
  protected abstract runChat(
    request: ProviderRequest,
    signal?: AbortSignal
  ): Promise<ProviderResponse>;
}
