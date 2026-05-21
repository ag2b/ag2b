import { Ag2bProviderResponseError } from '@/errors';
import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from '@/provider';
import { AbstractProvider, StreamableProvider } from '@/provider';

import type { AgentEvent } from '../../event';
import { AsyncQueue } from '../../sinks';
import { createStreamCaller } from '../stream.caller';

class SyncOnlyProvider extends AbstractProvider {
  constructor(private readonly response: ProviderResponse) {
    super({ baseURL: '/x' });
  }

  protected runChat(): Promise<ProviderResponse> {
    throw new Error('not used — chat is overridden');
  }

  override chat(): Promise<ProviderResponse> {
    return Promise.resolve(this.response);
  }
}

class StreamingProvider extends StreamableProvider {
  constructor(private readonly chunks: ProviderStreamChunk[]) {
    super({ baseURL: '/x' });
  }

  protected runChat(): Promise<ProviderResponse> {
    throw new Error('not used in streaming tests');
  }

  protected runChatStream(): AsyncGenerator<ProviderStreamChunk> {
    throw new Error('not used — chatStream is overridden');
  }

  override chat(): Promise<ProviderResponse> {
    return Promise.resolve({ content: 'unused' });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async *chatStream(): AsyncGenerator<ProviderStreamChunk> {
    for (const chunk of this.chunks) yield chunk;
  }
}

const makeRequest = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  messages: [],
  tools: [],
  contexts: [],
  ...overrides,
});

async function collect(queue: AsyncQueue): Promise<AgentEvent[]> {
  const items: AgentEvent[] = [];
  for await (const item of queue) items.push(item);
  return items;
}

async function runCaller(
  provider: AbstractProvider
): Promise<{ events: AgentEvent[]; response: ProviderResponse }> {
  const queue = new AsyncQueue();
  const collectPromise = collect(queue);
  const caller = createStreamCaller(provider, queue);

  const response = await caller(makeRequest());
  queue.end();

  return { events: await collectPromise, response };
}

describe('createStreamCaller', () => {
  describe('non-streamable provider fallback', () => {
    it('emits content delta from sync response', async () => {
      const provider = new SyncOnlyProvider({ content: 'Hello world', finishReason: 'stop' });
      const { events, response } = await runCaller(provider);

      expect(events).toEqual([{ type: 'agent_content_delta', delta: 'Hello world' }]);
      expect(response).toEqual({ content: 'Hello world', finishReason: 'stop' });
    });

    it('emits reasoning delta + reasoning_end before content', async () => {
      const provider = new SyncOnlyProvider({
        content: 'Answer',
        reasoning: 'Step 1',
        finishReason: 'stop',
      });
      const { events } = await runCaller(provider);

      expect(events).toEqual([
        { type: 'agent_reasoning_delta', delta: 'Step 1' },
        { type: 'agent_reasoning_end' },
        { type: 'agent_content_delta', delta: 'Answer' },
      ]);
    });

    it('emits no events when response has no content or reasoning', async () => {
      const provider = new SyncOnlyProvider({
        calls: [{ id: 'c1', name: 'sum', arguments: { a: 1 } }],
        finishReason: 'tool_calls',
      });
      const { events, response } = await runCaller(provider);

      expect(events).toEqual([]);
      expect(response.calls).toHaveLength(1);
    });
  });

  describe('streamable provider', () => {
    it('emits agent_content_delta for each provider_content_delta and accumulates content', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_content_delta', delta: 'Hello' },
        { type: 'provider_content_delta', delta: ' world' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ]);
      const { events, response } = await runCaller(provider);

      expect(events).toEqual([
        { type: 'agent_content_delta', delta: 'Hello' },
        { type: 'agent_content_delta', delta: ' world' },
      ]);
      expect(response.content).toBe('Hello world');
      expect(response.finishReason).toBe('stop');
    });

    it('drops empty content deltas (SSE keep-alive) but preserves whitespace', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_content_delta', delta: 'a' },
        { type: 'provider_content_delta', delta: '' },
        { type: 'provider_content_delta', delta: '\n' },
        { type: 'provider_content_delta', delta: '  ' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ]);
      const { events, response } = await runCaller(provider);

      expect(events.filter((e) => e.type === 'agent_content_delta')).toEqual([
        { type: 'agent_content_delta', delta: 'a' },
        { type: 'agent_content_delta', delta: '\n' },
        { type: 'agent_content_delta', delta: '  ' },
      ]);
      // Accumulated content keeps whitespace verbatim, including empty deltas
      expect(response.content).toBe('a\n  ');
    });

    it('emits agent_reasoning_delta and closes reasoning before first content', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_reasoning_delta', delta: 'Let me ' },
        { type: 'provider_reasoning_delta', delta: 'think.' },
        { type: 'provider_content_delta', delta: 'Done.' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ]);
      const { events, response } = await runCaller(provider);

      expect(events).toEqual([
        { type: 'agent_reasoning_delta', delta: 'Let me ' },
        { type: 'agent_reasoning_delta', delta: 'think.' },
        { type: 'agent_reasoning_end' },
        { type: 'agent_content_delta', delta: 'Done.' },
      ]);
      expect(response.reasoning).toBe('Let me think.');
    });

    it('emits agent_reasoning_end after the loop if no content/tool followed', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_reasoning_delta', delta: 'just thinking' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ]);
      const { events } = await runCaller(provider);

      expect(events).toEqual([
        { type: 'agent_reasoning_delta', delta: 'just thinking' },
        { type: 'agent_reasoning_end' },
      ]);
    });

    it('does not emit agent_reasoning_end when no reasoning was produced', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_content_delta', delta: 'plain' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ]);
      const { events } = await runCaller(provider);

      expect(events.some((e) => e.type === 'agent_reasoning_end')).toBe(false);
    });

    it('drops empty reasoning deltas', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_reasoning_delta', delta: '' },
        { type: 'provider_content_delta', delta: 'hi' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ]);
      const { events, response } = await runCaller(provider);

      expect(events.some((e) => e.type === 'agent_reasoning_delta')).toBe(false);
      expect(events.some((e) => e.type === 'agent_reasoning_end')).toBe(false);
      expect(response.reasoning).toBeUndefined();
    });

    it('closes reasoning before the first tool call delta', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_reasoning_delta', delta: 'choosing tool' },
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{"a":1}',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ]);
      const { events } = await runCaller(provider);

      // reasoning_end fires before any tool-call buffering work, even though
      // tool deltas don't produce agent events themselves.
      expect(events).toEqual([
        { type: 'agent_reasoning_delta', delta: 'choosing tool' },
        { type: 'agent_reasoning_end' },
      ]);
    });

    it('buffers tool call deltas and parses arguments JSON at the end', async () => {
      const provider = new StreamingProvider([
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{"a":1,',
        },
        { type: 'provider_tool_call_delta', index: 0, argumentsDelta: '"b":2}' },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ]);
      const { events, response } = await runCaller(provider);

      expect(events).toEqual([]); // tool deltas don't emit agent events
      expect(response.calls).toEqual([{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }]);
      expect(response.finishReason).toBe('tool_calls');
    });

    it('defaults arguments to {} when the tool stream sent no argumentsDelta payload', async () => {
      const provider = new StreamingProvider([
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'noop',
          argumentsDelta: '',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ]);
      const { response } = await runCaller(provider);

      expect(response.calls).toEqual([{ id: 'c1', name: 'noop', arguments: {} }]);
    });

    it('handles multiple parallel tool calls keyed by index', async () => {
      const provider = new StreamingProvider([
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{"a":1}',
        },
        {
          type: 'provider_tool_call_delta',
          index: 1,
          id: 'c2',
          name: 'sub',
          argumentsDelta: '{"a":2}',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ]);
      const { response } = await runCaller(provider);

      expect(response.calls).toEqual([
        { id: 'c1', name: 'sum', arguments: { a: 1 } },
        { id: 'c2', name: 'sub', arguments: { a: 2 } },
      ]);
    });

    it('throws Ag2bProviderResponseError with the offending event as body if the first tool_call_delta is missing id or name', async () => {
      const badEvent = {
        type: 'provider_tool_call_delta' as const,
        index: 0,
        argumentsDelta: '{}',
      };
      const provider = new StreamingProvider([badEvent]);

      const queue = new AsyncQueue();
      const caller = createStreamCaller(provider, queue);

      await expect(caller(makeRequest())).rejects.toBeInstanceOf(Ag2bProviderResponseError);
      await expect(caller(makeRequest())).rejects.toThrow(/First tool_call_delta/);
      await expect(caller(makeRequest())).rejects.toMatchObject({ body: badEvent });
    });

    it('throws Ag2bProviderResponseError with the raw buffer as body when accumulated tool arguments are not valid JSON', async () => {
      const provider = new StreamingProvider([
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{not-json',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ]);

      const queue = new AsyncQueue();
      const caller = createStreamCaller(provider, queue);

      await expect(caller(makeRequest())).rejects.toBeInstanceOf(Ag2bProviderResponseError);
      await expect(caller(makeRequest())).rejects.toThrow(
        /Failed to parse arguments for tool "sum"/
      );
      await expect(caller(makeRequest())).rejects.toMatchObject({ body: '{not-json' });
    });

    it('captures finishReason and metadata from provider_stream_done', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_content_delta', delta: 'hi' },
        {
          type: 'provider_stream_done',
          finishReason: 'stop',
          metadata: { reasoningSignature: 'sig-abc' },
        },
      ]);
      const { response } = await runCaller(provider);

      expect(response.finishReason).toBe('stop');
      expect(response.metadata).toEqual({ reasoningSignature: 'sig-abc' });
    });

    it('returns content/reasoning as undefined when stream produced none', async () => {
      const provider = new StreamingProvider([
        { type: 'provider_stream_done', finishReason: 'stop' },
      ]);
      const { response } = await runCaller(provider);

      expect(response.content).toBeUndefined();
      expect(response.reasoning).toBeUndefined();
      expect(response.calls).toEqual([]);
    });
  });
});
