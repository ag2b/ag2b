import type { ProviderRequest, ProviderResponse } from '@/provider';
import { AbstractProvider } from '@/provider';

import type { AgentEvent } from '../../event';
import type { EventSink } from '../../sinks';
import { createSyncCaller } from '../sync.caller';

class RecordingSink implements EventSink {
  public events: AgentEvent[] = [];
  push(event: AgentEvent): this {
    this.events.push(event);
    return this;
  }
}

class FakeProvider extends AbstractProvider {
  public lastCall?: { request: ProviderRequest; signal?: AbortSignal };

  constructor(private readonly response: ProviderResponse | Promise<ProviderResponse>) {
    super({ baseURL: '/x' });
  }

  protected runChat(): Promise<ProviderResponse> {
    throw new Error('not used — chat is overridden');
  }

  override chat(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse> {
    this.lastCall = { request, signal };
    return Promise.resolve(this.response);
  }
}

const makeRequest = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  messages: [],
  tools: [],
  contexts: [],
  ...overrides,
});

describe('createSyncCaller', () => {
  it('returns a caller that delegates to provider.chat', async () => {
    const provider = new FakeProvider({ content: 'hi', finishReason: 'stop' });
    const caller = createSyncCaller(provider);

    const response = await caller(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(response).toEqual({ content: 'hi', finishReason: 'stop' });
  });

  it('forwards request and signal to provider.chat', async () => {
    const provider = new FakeProvider({ content: 'ok' });
    const caller = createSyncCaller(provider);

    const request = makeRequest({
      messages: [{ role: 'user', content: 'hi' }],
      system: 'You are helpful',
    });
    const controller = new AbortController();

    await caller(request, controller.signal);

    expect(provider.lastCall?.request).toBe(request);
    expect(provider.lastCall?.signal).toBe(controller.signal);
  });

  it('propagates rejection from provider.chat', async () => {
    const provider = new FakeProvider(Promise.reject(new Error('network down')));
    const caller = createSyncCaller(provider);

    await expect(caller(makeRequest())).rejects.toThrow('network down');
  });

  describe('event sink', () => {
    it('emits content delta when response has content', async () => {
      const provider = new FakeProvider({ content: 'Hello world', finishReason: 'stop' });
      const sink = new RecordingSink();
      const caller = createSyncCaller(provider, sink);

      await caller(makeRequest());

      expect(sink.events).toEqual([{ type: 'agent_content_delta', delta: 'Hello world' }]);
    });

    it('emits reasoning delta + reasoning_end before content', async () => {
      const provider = new FakeProvider({
        content: 'Answer',
        reasoning: 'Step 1',
        finishReason: 'stop',
      });
      const sink = new RecordingSink();
      const caller = createSyncCaller(provider, sink);

      await caller(makeRequest());

      expect(sink.events).toEqual([
        { type: 'agent_reasoning_delta', delta: 'Step 1' },
        { type: 'agent_reasoning_end' },
        { type: 'agent_content_delta', delta: 'Answer' },
      ]);
    });

    it('emits no events when response has no content or reasoning', async () => {
      const provider = new FakeProvider({
        calls: [{ id: 'c1', name: 'sum', arguments: { a: 1 } }],
        finishReason: 'tool_calls',
      });
      const sink = new RecordingSink();
      const caller = createSyncCaller(provider, sink);

      await caller(makeRequest());

      expect(sink.events).toEqual([]);
    });
  });
});
