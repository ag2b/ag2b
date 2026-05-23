import type { ProviderResponse } from '@ag2b/core';
import { AbstractProvider, createAgent } from '@ag2b/core';
import { act, renderHook } from '@testing-library/react';

import { makeAgent, makeStreamingAgent, wrapper } from '../../__tests__/fixtures';
import { useChatController } from '../useChatController';

class HangingSyncProvider extends AbstractProvider {
  constructor() {
    super({ baseURL: '/x' });
  }
  protected runChat(): Promise<ProviderResponse> {
    throw new Error('not used');
  }
  override chat(_req: unknown, signal?: AbortSignal): Promise<ProviderResponse> {
    return new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason as Error));
    });
  }
}

describe('useChatController', () => {
  it('uses synchronous chat when mode="synchronous"', async () => {
    const agent = makeAgent([{ content: 'sync ok', finishReason: 'stop' }]);
    const { result } = renderHook(() => useChatController({ mode: 'synchronous' }), {
      wrapper: wrapper(agent),
    });
    expect(result.current.pendingMessage).toBeNull();
    await act(async () => {
      await result.current.send('hi');
    });
    expect(result.current.pendingMessage).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it('uses streaming chat when mode="streaming"', async () => {
    const agent = makeStreamingAgent([
      [
        { type: 'provider_content_delta', delta: 'streamed' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ],
    ]);
    const { result } = renderHook(() => useChatController({ mode: 'streaming' }), {
      wrapper: wrapper(agent),
    });
    await act(async () => {
      await result.current.send('hi');
    });
    expect(result.current.pendingMessage).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it('aborts the active controller when mode changes mid-flight', () => {
    const agent = makeStreamingAgent([
      [
        { type: 'provider_content_delta', delta: 'partial' },
        // no stream_done; relies on abort
      ],
    ]);
    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'streaming' | 'synchronous' }) => useChatController({ mode }),
      { wrapper: wrapper(agent), initialProps: { mode: 'streaming' } }
    );

    act(() => {
      void result.current.send('hi');
    });
    expect(result.current.isPending).toBe(true);

    rerender({ mode: 'synchronous' });

    expect(result.current.isPending).toBe(false);
  });

  it('aborts a pending synchronous chat when switching to streaming', () => {
    const agent = createAgent({ provider: new HangingSyncProvider() });
    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'streaming' | 'synchronous' }) => useChatController({ mode }),
      { wrapper: wrapper(agent), initialProps: { mode: 'synchronous' } }
    );

    act(() => {
      void result.current.send('hi');
    });
    expect(result.current.isPending).toBe(true);

    rerender({ mode: 'streaming' });

    expect(result.current.isPending).toBe(false);
  });
});
