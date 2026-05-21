import { OpenAiProvider } from '../openai.provider';
import { createMockFetch, createOpenAiResponse, req, type RequestBody, tools } from './fixtures';

describe('OpenAiProvider::Request', () => {
  it('should send correct request body', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Hi', 'stop'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await provider.chat(
      req({
        messages: [{ role: 'user', content: 'Hello' }],
        tools,
        system: 'You are helpful',
      })
    );

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as RequestBody;

    expect(url).toBe('http://localhost/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(body.stream).toBe(false);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are helpful' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Hello' });
    expect(body.tools).toHaveLength(1);
    expect(body.tools?.[0]?.type).toBe('function');
    expect(body.tools?.[0]?.function.name).toBe('sum');
  });

  it('should omit system message when not provided', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Hi', 'stop'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await provider.chat(req({ messages: [{ role: 'user', content: 'Hello' }], tools }));

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.role).toBe('user');
  });

  it('should omit tools when array is empty', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Hi', 'stop'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await provider.chat(req({ messages: [{ role: 'user', content: 'Hello' }] }));

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body.tools).toBeUndefined();
  });

  it('should send model field when configured', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Hi', 'stop'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
      model: 'gpt-4o-mini',
    });

    await provider.chat(req({ messages: [{ role: 'user', content: 'Hello' }] }));

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body.model).toBe('gpt-4o-mini');
  });

  it('should omit model field when not configured', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Hi', 'stop'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await provider.chat(req({ messages: [{ role: 'user', content: 'Hello' }] }));

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body).not.toHaveProperty('model');
  });

  it('should map assistant message with undefined content to null', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Done', 'stop'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await provider.chat(
      req({
        messages: [
          { role: 'user', content: 'Add 1+2' },
          {
            role: 'assistant',
            calls: [{ id: 'call_1', name: 'sum', arguments: { a: 1, b: 2 } }],
          },
          { role: 'tool', id: 'call_1', content: '3' },
        ],
        tools,
      })
    );

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body.messages[1]?.content).toBeNull();
  });

  it('should format assistant message with tool calls in history', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Done', 'stop'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await provider.chat(
      req({
        messages: [
          { role: 'user', content: 'Add 1+2' },
          {
            role: 'assistant',
            content: 'Let me calculate',
            calls: [{ id: 'call_1', name: 'sum', arguments: { a: 1, b: 2 } }],
          },
          { role: 'tool', id: 'call_1', content: '3' },
        ],
        tools,
      })
    );

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body.messages[1]?.role).toBe('assistant');
    expect(body.messages[1]?.content).toBe('Let me calculate');
    expect(body.messages[1]?.tool_calls?.[0]?.function.arguments).toBe('{"a":1,"b":2}');

    expect(body.messages[2]?.role).toBe('tool');
    expect(body.messages[2]?.tool_call_id).toBe('call_1');
    expect(body.messages[2]?.content).toBe('3');
  });
});
