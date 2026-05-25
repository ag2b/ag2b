import { Ag2bProviderResponseError } from '@/errors';
import type { FinishReason } from '@/messages';
import type { AbstractProvider, ProviderResponse } from '@/provider';
import { isStreamableProvider } from '@/provider';

import type { EventSink } from '../sinks';
import type { ProviderCaller } from './caller';
import { createSyncCaller } from './sync.caller';

/**
 * Creates a streaming provider caller. If the provider implements {@link StreamableProvider},
 * consumes real SSE chunks and pushes `agent_*` events (content, reasoning, tool boundaries)
 * to the queue as they arrive. Otherwise falls back to {@link AbstractProvider.chat} and
 * fabricates the same event sequence from the single response.
 * @param provider - The LLM provider to call.
 * @param sink - Sink to push {@link AgentEvent} into for the consumer.
 */
export function createStreamCaller(provider: AbstractProvider, sink: EventSink): ProviderCaller {
  return async (request, signal): Promise<ProviderResponse> => {
    if (!isStreamableProvider(provider)) {
      const caller = createSyncCaller(provider, sink);

      return caller(request, signal);
    }

    let content = '';
    let reasoning = '';
    let reasoningClosed = false;
    let metadata: Record<string, unknown> | undefined;
    let finishReason: FinishReason | undefined;
    const toolCallBuffers = new Map<number, { id: string; name: string; arguments: string }>();

    const closeReasoning = () => {
      if (reasoning && !reasoningClosed) {
        sink.push({ type: 'agent_reasoning_end' });
        reasoningClosed = true;
      }
    };

    for await (const event of provider.chatStream(request, signal)) {
      switch (event.type) {
        case 'provider_reasoning_delta':
          if (event.delta) {
            reasoning += event.delta;
            sink.push({ type: 'agent_reasoning_delta', delta: event.delta });
          }
          break;

        case 'provider_content_delta':
          closeReasoning();
          content += event.delta;
          // Filter only truly empty strings (SSE keep-alive). Whitespace — including
          // newlines — must flow through so multi-line streaming output renders with
          // its line breaks intact. Accumulated `content` (sent back to the LLM) has
          // always included them; this only corrects the queue shown to consumers.
          if (event.delta) {
            sink.push({ type: 'agent_content_delta', delta: event.delta });
          }
          break;

        case 'provider_tool_call_delta': {
          closeReasoning();
          let buf = toolCallBuffers.get(event.index);
          if (!buf) {
            if (!event.id || !event.name) {
              throw new Ag2bProviderResponseError(
                'First tool_call_delta chunk must include id and name',
                event
              );
            }

            buf = { id: event.id, name: event.name, arguments: '' };
            toolCallBuffers.set(event.index, buf);
          }
          buf.arguments += event.argumentsDelta;

          sink.push({
            type: 'agent_tool_call_delta',
            index: event.index,
            id: event.id,
            name: event.name,
            argumentsDelta: event.argumentsDelta,
          });

          break;
        }

        case 'provider_stream_done':
          finishReason = event.finishReason;
          metadata = event.metadata;
          break;
      }
    }

    closeReasoning();

    const calls = [...toolCallBuffers.values()].map((buf) => {
      try {
        return {
          id: buf.id,
          name: buf.name,
          arguments: buf.arguments ? (JSON.parse(buf.arguments) as Record<string, unknown>) : {},
        };
      } catch {
        throw new Ag2bProviderResponseError(
          `Failed to parse arguments for tool "${buf.name}"`,
          buf.arguments
        );
      }
    });

    return {
      content: content || undefined,
      reasoning: reasoning || undefined,
      metadata,
      calls,
      finishReason,
    };
  };
}
