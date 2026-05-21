import { Ag2bProviderRequestError, Ag2bProviderResponseError } from '@/errors';

import { OpenAiProvider } from '../openai.provider';
import { createMockFetch, createOpenAiResponse, req, tools } from './fixtures';

describe('OpenAiProvider::chat', () => {
  it('should return text response on finish_reason stop', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Hello!', 'stop'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Hi' }], tools })
    );

    expect(response.content).toBe('Hello!');
    expect(response.finishReason).toBe('stop');
    expect(response.calls).toBeUndefined();
  });

  it('should return tool calls on finish_reason tool_calls', async () => {
    const mockFetch = createMockFetch(
      createOpenAiResponse(null, 'tool_calls', [
        { id: 'call_1', type: 'function', function: { name: 'sum', arguments: '{"a":1,"b":2}' } },
      ])
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Add 1 and 2' }], tools })
    );

    expect(response.finishReason).toBe('tool_calls');
    expect(response.calls).toEqual([{ id: 'call_1', name: 'sum', arguments: { a: 1, b: 2 } }]);
    expect(response.content).toBeUndefined();
  });

  it('should return content alongside tool calls when present', async () => {
    const mockFetch = createMockFetch(
      createOpenAiResponse('Let me calculate that', 'tool_calls', [
        { id: 'call_1', type: 'function', function: { name: 'sum', arguments: '{"a":1,"b":2}' } },
      ])
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Add 1 and 2' }], tools })
    );

    expect(response.content).toBe('Let me calculate that');
    expect(response.calls).toHaveLength(1);
  });

  it('should handle finish_reason length', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('Truncated...', 'length'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Hi' }], tools })
    );

    expect(response.finishReason).toBe('length');
    expect(response.content).toBe('Truncated...');
  });

  it('should normalize content_filter to stop', async () => {
    const mockFetch = createMockFetch(createOpenAiResponse('', 'content_filter'));
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Hi' }], tools })
    );

    expect(response.finishReason).toBe('stop');
  });

  it('should throw Ag2bProviderRequestError on non-ok response', async () => {
    const mockFetch = createMockFetch({ error: 'Bad request' }, false, 400);
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await expect(
      provider.chat(req({ messages: [{ role: 'user', content: 'Hi' }], tools }))
    ).rejects.toThrow(Ag2bProviderRequestError);
  });

  it('should throw Ag2bProviderResponseError with the raw response body on empty choices', async () => {
    const responseBody = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      model: 'gpt-4o',
      choices: [],
    };
    const mockFetch = createMockFetch(responseBody);
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await expect(
      provider.chat(req({ messages: [{ role: 'user', content: 'Hi' }], tools }))
    ).rejects.toBeInstanceOf(Ag2bProviderResponseError);
    await expect(
      provider.chat(req({ messages: [{ role: 'user', content: 'Hi' }], tools }))
    ).rejects.toMatchObject({ body: responseBody });
  });

  it('should throw Ag2bProviderResponseError with tool name in message and raw args in body when tool arguments are not valid JSON', async () => {
    const mockFetch = createMockFetch(
      createOpenAiResponse(null, 'tool_calls', [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'sum', arguments: '{"a":1,"b":' },
        },
      ])
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://localhost/v1/chat/completions',
      fetch: mockFetch,
    });

    await expect(
      provider.chat(req({ messages: [{ role: 'user', content: 'Add 1 and 2' }], tools }))
    ).rejects.toThrow(/Failed to parse arguments for tool "sum"/);
    await expect(
      provider.chat(req({ messages: [{ role: 'user', content: 'Add 1 and 2' }], tools }))
    ).rejects.toMatchObject({ body: '{"a":1,"b":' });
    await expect(
      provider.chat(req({ messages: [{ role: 'user', content: 'Add 1 and 2' }], tools }))
    ).rejects.toBeInstanceOf(Ag2bProviderResponseError);
  });
});
