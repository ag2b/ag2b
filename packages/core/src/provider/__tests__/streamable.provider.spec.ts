import type { ProviderRequest, ProviderResponse } from '../abstract.provider';
import { AbstractProvider } from '../abstract.provider';
import type { ProviderStreamChunk } from '../streamable.provider';
import { isStreamableProvider, StreamableProvider } from '../streamable.provider';

class NonStreamingProvider extends AbstractProvider {
  protected runChat(): Promise<ProviderResponse> {
    return Promise.resolve({ content: 'test' });
  }
}

class TestStreamingProvider extends StreamableProvider {
  public runChatStreamCalls: [ProviderRequest, AbortSignal | undefined][] = [];
  public chunks: ProviderStreamChunk[] = [{ type: 'provider_stream_done', finishReason: 'stop' }];

  protected runChat(): Promise<ProviderResponse> {
    return Promise.resolve({ content: 'test' });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async *runChatStream(
    req: ProviderRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ProviderStreamChunk> {
    this.runChatStreamCalls.push([req, signal]);
    for (const chunk of this.chunks) yield chunk;
  }
}

const baseRequest = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  messages: [{ role: 'user', content: 'hi' }],
  tools: [],
  contexts: [],
  ...overrides,
});

async function drain<T>(stream: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of stream) out.push(item);
  return out;
}

describe('StreamableProvider', () => {
  describe('StreamableProvider::isStreamableProvider', () => {
    it('returns false for AbstractProvider subclasses', () => {
      const provider = new NonStreamingProvider({ baseURL: '/api/chat' });

      expect(isStreamableProvider(provider)).toBe(false);
    });

    it('returns true for StreamableProvider subclasses', () => {
      const provider = new TestStreamingProvider({ baseURL: '/api/chat' });

      expect(isStreamableProvider(provider)).toBe(true);
    });
  });

  describe('StreamableProvider::chatStream', () => {
    it('forwards the prepared request (not the input) to runChatStream', async () => {
      const provider = new TestStreamingProvider({ baseURL: '/api/chat' });
      const contexts = [{ label: 'l', injection: 'system' as const, content: 'c' }];
      const request = baseRequest({ contexts, system: 'base' });

      await drain(provider.chatStream(request));

      const received = provider.runChatStreamCalls[0]?.[0];
      expect(received?.system).toBe('base\n\n## l\nc');
      expect(received?.contexts).toBe(contexts);
    });

    it('forwards the abort signal to runChatStream', async () => {
      const provider = new TestStreamingProvider({ baseURL: '/api/chat' });
      const signal = new AbortController().signal;

      await drain(provider.chatStream(baseRequest(), signal));

      expect(provider.runChatStreamCalls[0]?.[1]).toBe(signal);
    });

    it('yields chunks produced by runChatStream in order', async () => {
      const provider = new TestStreamingProvider({ baseURL: '/api/chat' });
      provider.chunks = [
        { type: 'provider_content_delta', delta: 'hello' },
        { type: 'provider_content_delta', delta: ' world' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ];

      const chunks = await drain(provider.chatStream(baseRequest()));

      expect(chunks).toEqual([
        { type: 'provider_content_delta', delta: 'hello' },
        { type: 'provider_content_delta', delta: ' world' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ]);
    });
  });
});
