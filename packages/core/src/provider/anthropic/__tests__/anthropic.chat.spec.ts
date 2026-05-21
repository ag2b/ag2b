import { Ag2bProviderRequestError } from '@/errors';

import { AnthropicProvider } from '../anthropic.provider';
import { createAnthropicResponse, createMockFetch, req, tools } from './fixtures';

describe('AnthropicProvider::chat', () => {
  it('should return text response on stop_reason end_turn', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Hello!' }], 'end_turn')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Hi' }], tools })
    );

    expect(response.content).toBe('Hello!');
    expect(response.finishReason).toBe('stop');
    expect(response.calls).toBeUndefined();
  });

  it('should return tool calls on stop_reason tool_use', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse(
        [{ type: 'tool_use', id: 'toolu_1', name: 'sum', input: { a: 1, b: 2 } }],
        'tool_use'
      )
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Add 1 and 2' }], tools })
    );

    expect(response.finishReason).toBe('tool_calls');
    expect(response.calls).toEqual([{ id: 'toolu_1', name: 'sum', arguments: { a: 1, b: 2 } }]);
    expect(response.content).toBeUndefined();
  });

  it('should return content alongside tool calls when present', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse(
        [
          { type: 'text', text: 'Let me calculate that' },
          { type: 'tool_use', id: 'toolu_1', name: 'sum', input: { a: 1, b: 2 } },
        ],
        'tool_use'
      )
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Add 1 and 2' }], tools })
    );

    expect(response.content).toBe('Let me calculate that');
    expect(response.calls).toHaveLength(1);
  });

  it('should concatenate multiple text blocks into content', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse(
        [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
        'end_turn'
      )
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Hi' }], tools })
    );

    expect(response.content).toBe('Hello world');
  });

  it('should handle stop_reason max_tokens', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Truncated...' }], 'max_tokens')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Hi' }], tools })
    );

    expect(response.finishReason).toBe('length');
    expect(response.content).toBe('Truncated...');
  });

  it('should normalize stop_sequence to stop', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Hi' }], 'stop_sequence')
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Hi' }], tools })
    );

    expect(response.finishReason).toBe('stop');
  });

  it('should default null stop_reason to stop', async () => {
    const mockFetch = createMockFetch(
      createAnthropicResponse([{ type: 'text', text: 'Hi' }], null)
    );
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    const response = await provider.chat(
      req({ messages: [{ role: 'user', content: 'Hi' }], tools })
    );

    expect(response.finishReason).toBe('stop');
  });

  it('should throw Ag2bProviderRequestError on non-ok response', async () => {
    const mockFetch = createMockFetch({ error: 'Bad request' }, false, 400);
    const provider = new AnthropicProvider({
      baseURL: 'http://localhost/v1/messages',
      fetch: mockFetch,
    });

    await expect(
      provider.chat(req({ messages: [{ role: 'user', content: 'Hi' }], tools }))
    ).rejects.toThrow(Ag2bProviderRequestError);
  });
});
