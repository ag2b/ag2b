import type { FinishReason } from '@/messages';

import type { ProviderRequest } from './abstract.provider';
import { AbstractProvider } from './abstract.provider';

/** A chunk of text content from the provider SSE stream. */
export type ProviderContentDelta = {
  type: 'provider_content_delta';
  /** Partial text content (one or more tokens). */
  delta: string;
};

/**
 * A chunk of reasoning/thinking text from the provider SSE stream.
 * Separate channel from {@link ProviderContentDelta} so consumers can render "thinking…" UI without it bleeding into the visible assistant reply.
 */
export type ProviderReasoningDelta = {
  type: 'provider_reasoning_delta';
  /** Partial reasoning text (one or more tokens). */
  delta: string;
};

/**
 * A chunk of a tool call from the provider SSE stream.
 * Arrives incrementally — first chunk carries `id` and `name`, subsequent chunks carry `argumentsDelta`.
 */
export type ProviderToolCallDelta = {
  type: 'provider_tool_call_delta';
  /** Tool call index in the response. Identifies which tool call this chunk belongs to when multiple tools are called in parallel. */
  index: number;
  /** Tool call ID. Present on the first chunk only. */
  id?: string;
  /** Tool name. Present on the first chunk only. */
  name?: string;
  /** Partial JSON string of the tool call arguments. Concatenate all chunks to get the full JSON. */
  argumentsDelta: string;
};

/** Signals that the provider SSE stream is complete. */
export type ProviderStreamDone = {
  type: 'provider_stream_done';
  /** Reason the LLM stopped generating. */
  finishReason: FinishReason;
  /**
   * Provider-specific data that must survive history persistence.
   * Consumers generally don't read this — it's plumbing for provider serialization.
   */
  metadata?: Record<string, unknown>;
};

/** Union of all provider-level stream chunk types. */
export type ProviderStreamChunk =
  | ProviderContentDelta
  | ProviderReasoningDelta
  | ProviderToolCallDelta
  | ProviderStreamDone;

/** Base class for LLM providers that support SSE streaming. */
export abstract class StreamableProvider extends AbstractProvider {
  /**
   * Streams a chat response from the LLM as incremental chunks. Called by the
   * agent — never overridden by subclasses.
   *
   * @param request - {@link ProviderRequest}
   * @param signal - Optional AbortSignal for cancellation.
   */
  public async *chatStream(
    request: ProviderRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ProviderStreamChunk> {
    const prepared = this.prepareRequest(request);
    yield* this.runChatStream(prepared, signal);
  }

  /**
   * Sends the prepared request to the provider's streaming API and yields
   * normalized {@link ProviderStreamChunk} events. Implemented by every
   * concrete streaming provider.
   *
   * The `request` argument has already been run through `prepareRequest`,
   * so `messages` / `system` are the source of truth for what gets sent.
   * Implementations must not re-inline `request.contexts` — it's informational
   * (e.g. for logging) unless a custom `prepareRequest` override defines a
   * provider-specific meaning for it.
   *
   * @param request - {@link ProviderRequest}
   * @param signal - Optional AbortSignal for cancellation.
   */
  protected abstract runChatStream(
    request: ProviderRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ProviderStreamChunk>;
}

export function isStreamableProvider(provider: AbstractProvider): provider is StreamableProvider {
  return provider instanceof StreamableProvider;
}
