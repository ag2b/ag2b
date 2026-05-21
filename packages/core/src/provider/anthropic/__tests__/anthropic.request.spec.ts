import { AnthropicProvider } from '../anthropic.provider';
import { createAnthropicResponse, createMockFetch, req, type RequestBody, tools } from './fixtures';

describe('AnthropicProvider::Request', () => {
  it('should send correct request body', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Hi' }], 'end_turn')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
      model: 'claude-sonnet-4-6',
      maxTokens: 1024,
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

    expect(url).toBe('http://localhost/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(body.stream).toBe(false);
    expect(body.model).toBe('claude-sonnet-4-6');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toBe('You are helpful');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(body.tools).toHaveLength(1);
    expect(body.tools?.[0]?.name).toBe('sum');
    expect(body.tools?.[0]?.description).toBe('Sum two numbers');
    expect(body.tools?.[0]?.input_schema).toBeDefined();
  });

  it('should omit system when not provided', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Hi' }], 'end_turn')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await provider.chat(req({ messages: [{ role: 'user', content: 'Hello' }], tools }));

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body).not.toHaveProperty('system');
  });

  it('should omit tools when array is empty', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Hi' }], 'end_turn')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await provider.chat(req({ messages: [{ role: 'user', content: 'Hello' }] }));

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body.tools).toBeUndefined();
  });

  it('should omit model and max_tokens when not configured', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Hi' }], 'end_turn')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await provider.chat(req({ messages: [{ role: 'user', content: 'Hello' }] }));

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body).not.toHaveProperty('model');
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('should format assistant message with tool_use content blocks', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Done' }], 'end_turn')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await provider.chat(
      req({
        messages: [
          { role: 'user', content: 'Add 1+2' },
          {
            role: 'assistant',
            content: 'Let me calculate',
            calls: [{ id: 'toolu_1', name: 'sum', arguments: { a: 1, b: 2 } }],
          },
          { role: 'tool', id: 'toolu_1', content: '3' },
        ],
        tools,
      })
    );

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    const assistantMessage = body.messages[1]!;
    expect(assistantMessage.role).toBe('assistant');
    expect(assistantMessage.content).toEqual([
      { type: 'text', text: 'Let me calculate' },
      { type: 'tool_use', id: 'toolu_1', name: 'sum', input: { a: 1, b: 2 } },
    ]);

    const toolResultMessage = body.messages[2]!;
    expect(toolResultMessage.role).toBe('user');
    expect(toolResultMessage.content).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_1', content: '3' },
    ]);
  });

  it('should skip text block for assistant message with only tool calls (no content)', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Done' }], 'end_turn')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await provider.chat(
      req({
        messages: [
          { role: 'user', content: 'Add 1+2' },
          {
            role: 'assistant',
            calls: [{ id: 'toolu_1', name: 'sum', arguments: { a: 1, b: 2 } }],
          },
          { role: 'tool', id: 'toolu_1', content: '3' },
        ],
        tools,
      })
    );

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    const assistantMessage = body.messages[1]!;
    expect(assistantMessage.content).toEqual([
      { type: 'tool_use', id: 'toolu_1', name: 'sum', input: { a: 1, b: 2 } },
    ]);
  });

  it('should merge consecutive tool messages into one user message with multiple tool_result blocks', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Done' }], 'end_turn')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await provider.chat(
      req({
        messages: [
          { role: 'user', content: 'Do both' },
          {
            role: 'assistant',
            calls: [
              { id: 'toolu_1', name: 'sum', arguments: { a: 1, b: 2 } },
              { id: 'toolu_2', name: 'sum', arguments: { a: 3, b: 4 } },
            ],
          },
          { role: 'tool', id: 'toolu_1', content: '3' },
          { role: 'tool', id: 'toolu_2', content: '7' },
        ],
        tools,
      })
    );

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as RequestBody;

    expect(body.messages).toHaveLength(3);
    const merged = body.messages[2]!;
    expect(merged.role).toBe('user');
    expect(merged.content).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_1', content: '3' },
      { type: 'tool_result', tool_use_id: 'toolu_2', content: '7' },
    ]);
  });
});
