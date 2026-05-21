import type { ProviderRequest, ProviderResponse } from '../abstract.provider';
import { AbstractProvider } from '../abstract.provider';

class TestProvider extends AbstractProvider {
  public runChatSpy = vi.fn<
    (req: ProviderRequest, signal?: AbortSignal) => Promise<ProviderResponse>
  >(() => Promise.resolve({ content: 'ok' }));

  protected runChat(req: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse> {
    return this.runChatSpy(req, signal);
  }

  public getBaseURL() {
    return this.baseURL;
  }

  public getFetch() {
    return this.fetch;
  }

  public callPrepareRequest(req: ProviderRequest) {
    return this.prepareRequest(req);
  }
}

class CustomPrepProvider extends AbstractProvider {
  public runChatSpy = vi.fn<
    (req: ProviderRequest, signal?: AbortSignal) => Promise<ProviderResponse>
  >(() => Promise.resolve({ content: 'ok' }));

  protected runChat(req: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse> {
    return this.runChatSpy(req, signal);
  }

  protected override prepareRequest(req: ProviderRequest): ProviderRequest {
    return { ...req, system: 'OVERRIDDEN' };
  }
}

const baseRequest = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  messages: [{ role: 'user', content: 'hi' }],
  tools: [],
  contexts: [],
  ...overrides,
});

describe('AbstractProvider', () => {
  describe('AbstractProvider::construction', () => {
    it('stores baseURL from config', () => {
      const provider = new TestProvider({ baseURL: '/api/chat' });

      expect(provider.getBaseURL()).toBe('/api/chat');
    });

    it('uses custom fetch when provided', () => {
      const customFetch = vi.fn();

      const provider = new TestProvider({
        baseURL: '/api/chat',
        fetch: customFetch as unknown as typeof fetch,
      });

      expect(provider.getFetch()).toBe(customFetch);
    });

    it('defaults to globalThis.fetch when not provided', () => {
      const provider = new TestProvider({ baseURL: '/api/chat' });

      expect(typeof provider.getFetch()).toBe('function');
    });
  });

  describe('AbstractProvider::chat', () => {
    it('forwards the prepared request (not the input) to runChat', async () => {
      const provider = new TestProvider({ baseURL: '/api/chat' });
      const contexts = [{ label: 'l', injection: 'system' as const, content: 'c' }];
      const request = baseRequest({ contexts, system: 'base' });

      await provider.chat(request);

      const received = provider.runChatSpy.mock.calls[0]?.[0];
      expect(received?.system).toBe('base\n\n## l\nc');
      expect(received?.contexts).toBe(contexts);
    });

    it('forwards the abort signal to runChat', async () => {
      const provider = new TestProvider({ baseURL: '/api/chat' });
      const signal = new AbortController().signal;

      await provider.chat(baseRequest(), signal);

      expect(provider.runChatSpy.mock.calls[0]?.[1]).toBe(signal);
    });

    it('returns the response produced by runChat', async () => {
      const provider = new TestProvider({ baseURL: '/api/chat' });
      provider.runChatSpy.mockResolvedValueOnce({ content: 'pong' });

      const result = await provider.chat(baseRequest());

      expect(result).toEqual({ content: 'pong' });
    });

    it('honors a subclass override of prepareRequest', async () => {
      const provider = new CustomPrepProvider({ baseURL: '/api/chat' });
      await provider.chat(baseRequest({ system: 'base' }));

      const received = provider.runChatSpy.mock.calls[0]?.[0];
      expect(received?.system).toBe('OVERRIDDEN');
    });
  });

  describe('AbstractProvider::prepareRequest', () => {
    let provider: TestProvider;

    beforeEach(() => {
      provider = new TestProvider({ baseURL: '/api/chat' });
    });

    it('preserves the contexts reference on the returned request', () => {
      const contexts = [{ label: 'l', injection: 'system' as const, content: 'c' }];
      const request = baseRequest({ contexts });

      const result = provider.callPrepareRequest(request);

      expect(result.contexts).toBe(contexts);
    });

    it('inlines system contexts into the system prompt', () => {
      const request = baseRequest({
        contexts: [{ label: 'l', injection: 'system', content: 'c' }],
        system: 'base',
      });

      const result = provider.callPrepareRequest(request);

      expect(result.system).toBe('base\n\n## l\nc');
    });

    it('inlines user contexts into the last user message', () => {
      const request = baseRequest({
        contexts: [{ label: 'l', injection: 'user', content: 'c' }],
      });

      const result = provider.callPrepareRequest(request);

      expect(result.messages).toEqual([{ role: 'user', content: 'hi\n\n## l\nc' }]);
    });

    it('preserves the tools array reference', () => {
      const tools: ProviderRequest['tools'] = [];
      const request = baseRequest({ tools });

      const result = provider.callPrepareRequest(request);

      expect(result.tools).toBe(tools);
    });

    it('does not mutate the input request', () => {
      const request = baseRequest({
        contexts: [{ label: 'l', injection: 'system', content: 'c' }],
        system: 'base',
      });
      const snapshot = structuredClone(request);

      provider.callPrepareRequest(request);

      expect(request).toEqual(snapshot);
    });

    it('is a no-op pass-through when no contexts were given', () => {
      const request = baseRequest({ system: 'base' });

      const result = provider.callPrepareRequest(request);

      expect(result.system).toBe('base');
      expect(result.messages).toBe(request.messages);
      expect(result.contexts).toBe(request.contexts);
    });
  });
});
