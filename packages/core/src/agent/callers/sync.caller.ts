import type { ProviderResponse } from '@/provider';
import { AbstractProvider } from '@/provider';

import type { EventSink } from '../sinks';
import type { ProviderCaller } from './caller';

/**
 * Creates a non-streaming provider caller that uses {@link AbstractProvider.chat}.
 * When a sink is provided, fabricates `agent_*` reasoning/content events from the
 * single response so consumers of `chat({ onEvent })` see the same event sequence
 * as the non-streamable fallback in {@link createStreamCaller}.
 * @param provider - The LLM provider to call.
 * @param sink - Optional sink to receive fabricated reasoning/content events.
 */
export function createSyncCaller(provider: AbstractProvider, sink?: EventSink): ProviderCaller {
  return async (request, signal): Promise<ProviderResponse> => {
    const response = await provider.chat(request, signal);

    if (sink) {
      if (response.reasoning) {
        sink.push({ type: 'agent_reasoning_delta', delta: response.reasoning });
        sink.push({ type: 'agent_reasoning_end' });
      }
      if (response.content) {
        sink.push({ type: 'agent_content_delta', delta: response.content });
      }
    }

    return response;
  };
}
