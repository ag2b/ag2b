import { Ag2bProviderRequestError, Ag2bProviderResponseError } from '@/errors';

import { AnthropicProvider } from '../anthropic.provider';
import { createStreamFetch, req, type RequestBody, tools } from './fixtures';

async function collectEvents(provider: AnthropicProvider, message = 'Hi') {
  const events = [];
  for await (const event of provider.chatStream(
    req({ messages: [{ role: 'user', content: message }], tools })
  )) {
    events.push(event);
  }
  return events;
}

describe('AnthropicProvider::chatStream', () => {
  it('should yield provider_content_delta for text_delta chunks', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({ type: 'message_start', message: {} }),
      JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
      JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      }),
      JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: ' world' },
      }),
      JSON.stringify({ type: 'content_block_stop', index: 0 }),
      JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
      }),
      JSON.stringify({ type: 'message_stop' })
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events).toEqual([
      { type: 'provider_content_delta', delta: 'Hello' },
      { type: 'provider_content_delta', delta: ' world' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ]);
  });

  it('should yield provider_tool_call_delta events with id/name on start and argumentsDelta from input_json_delta', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({ type: 'message_start', message: {} }),
      JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: 'toolu_1', name: 'sum', input: {} },
      }),
      JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"a":1,' },
      }),
      JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '"b":2}' },
      }),
      JSON.stringify({ type: 'content_block_stop', index: 0 }),
      JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'tool_use', stop_sequence: null },
      }),
      JSON.stringify({ type: 'message_stop' })
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events[0]).toEqual({
      type: 'provider_tool_call_delta',
      index: 0,
      id: 'toolu_1',
      name: 'sum',
      argumentsDelta: '',
    });
    expect(events[1]).toEqual({
      type: 'provider_tool_call_delta',
      index: 0,
      argumentsDelta: '{"a":1,',
    });
    expect(events[2]).toEqual({
      type: 'provider_tool_call_delta',
      index: 0,
      argumentsDelta: '"b":2}',
    });
    expect(events[3]).toEqual({ type: 'provider_stream_done', finishReason: 'tool_calls' });
  });

  it('should send stream: true in request', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
      })
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await collectEvents(provider);

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;
    expect(body.stream).toBe(true);
  });

  it('should throw Ag2bProviderRequestError on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal error'),
    });
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await expect(collectEvents(provider)).rejects.toThrow(Ag2bProviderRequestError);
  });

  it('should handle SSE data split across multiple network chunks', async () => {
    const encoder = new TextEncoder();
    const full =
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n' +
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null}}\n\n';
    const mid = Math.floor(full.length / 2);
    const chunk1 = encoder.encode(full.slice(0, mid));
    const chunk2 = encoder.encode(full.slice(mid));
    let readIndex = 0;
    const chunks = [chunk1, chunk2];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: () => {
            if (readIndex < chunks.length) {
              return Promise.resolve({ done: false, value: chunks[readIndex++] });
            }
            return Promise.resolve({ done: true, value: undefined });
          },
          releaseLock: vi.fn(),
        }),
      },
    });

    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events).toEqual([
      { type: 'provider_content_delta', delta: 'Hi' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ]);
  });

  it('should ignore message_start, content_block_stop, message_stop, and ping events', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({ type: 'message_start', message: {} }),
      JSON.stringify({ type: 'ping' }),
      JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
      JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hi' },
      }),
      JSON.stringify({ type: 'content_block_stop', index: 0 }),
      JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
      }),
      JSON.stringify({ type: 'message_stop' })
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events).toEqual([
      { type: 'provider_content_delta', delta: 'Hi' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ]);
  });

  it('should throw Ag2bProviderResponseError with the upstream error object as body on stream error event', async () => {
    const upstreamError = { type: 'overloaded_error', message: 'Overloaded' };
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: createStreamFetch(JSON.stringify({ type: 'error', error: upstreamError })),
    });

    const error = await collectEvents(provider).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Ag2bProviderResponseError);
    expect((error as Error).message).toMatch(/Overloaded/);
    expect((error as Ag2bProviderResponseError).body).toEqual(upstreamError);
  });

  it('should throw Ag2bProviderResponseError when response body is null', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    });
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await expect(collectEvents(provider)).rejects.toBeInstanceOf(Ag2bProviderResponseError);
  });

  it('should skip event: lines and parse only data: lines', async () => {
    const encoder = new TextEncoder();
    const raw =
      'event: content_block_delta\n' +
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n' +
      'event: message_delta\n' +
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null}}\n\n';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => {
          let read = false;
          return {
            read: () => {
              if (!read) {
                read = true;
                return Promise.resolve({ done: false, value: encoder.encode(raw) });
              }
              return Promise.resolve({ done: true, value: undefined });
            },
            releaseLock: vi.fn(),
          };
        },
      },
    });

    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events).toEqual([
      { type: 'provider_content_delta', delta: 'Hi' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ]);
  });
});
