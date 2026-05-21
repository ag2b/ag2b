import { Ag2bProviderRequestError, Ag2bProviderResponseError } from '@/errors';

import { OpenAiProvider } from '../openai.provider';
import { createStreamFetch, req, type RequestBody, tools } from './fixtures';

async function collectEvents(provider: OpenAiProvider, message = 'Hi') {
  const events = [];
  for await (const event of provider.chatStream(
    req({ messages: [{ role: 'user', content: message }], tools })
  )) {
    events.push(event);
  }
  return events;
}

describe('OpenAiProvider::chatStream', () => {
  it('should yield provider_content_delta for text chunks', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({ choices: [{ delta: { content: 'Hello' }, finish_reason: null }] }),
      JSON.stringify({ choices: [{ delta: { content: ' world' }, finish_reason: null }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events).toEqual([
      { type: 'provider_content_delta', delta: 'Hello' },
      { type: 'provider_content_delta', delta: ' world' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ]);
  });

  it('should yield provider_tool_call_delta events', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: 'call_1', function: { name: 'sum', arguments: '' } }],
            },
            finish_reason: null,
          },
        ],
      }),
      JSON.stringify({
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: '{"a":1,' } }] },
            finish_reason: null,
          },
        ],
      }),
      JSON.stringify({
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: '"b":2}' } }] },
            finish_reason: null,
          },
        ],
      }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events[0]).toEqual({
      type: 'provider_tool_call_delta',
      index: 0,
      id: 'call_1',
      name: 'sum',
      argumentsDelta: '',
    });
    expect(events[1]).toMatchObject({
      type: 'provider_tool_call_delta',
      argumentsDelta: '{"a":1,',
    });
    expect(events[2]).toMatchObject({
      type: 'provider_tool_call_delta',
      argumentsDelta: '"b":2}',
    });
    expect(events[3]).toEqual({ type: 'provider_stream_done', finishReason: 'tool_calls' });
  });

  it('should send stream: true in request', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({ choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop' }] })
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
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
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await expect(collectEvents(provider)).rejects.toThrow(Ag2bProviderRequestError);
  });

  it('should handle SSE data split across multiple network chunks', async () => {
    const encoder = new TextEncoder();
    const full =
      'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
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

    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events).toEqual([
      { type: 'provider_content_delta', delta: 'Hi' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ]);
  });

  it('should handle tool_call_delta with missing function arguments', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: 'call_1', function: { name: 'sum' } }],
            },
            finish_reason: null,
          },
        ],
      }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events[0]).toEqual({
      type: 'provider_tool_call_delta',
      index: 0,
      id: 'call_1',
      name: 'sum',
      argumentsDelta: '',
    });
  });

  it('should skip empty choices in stream chunk', async () => {
    const mockFetch = createStreamFetch(
      JSON.stringify({ choices: [] }),
      JSON.stringify({ choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop' }] })
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const events = await collectEvents(provider);

    expect(events).toEqual([
      { type: 'provider_content_delta', delta: 'Hi' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ]);
  });

  it('should throw Ag2bProviderResponseError when response body is null', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    });
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await expect(collectEvents(provider)).rejects.toBeInstanceOf(Ag2bProviderResponseError);
  });
});
