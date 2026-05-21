import type { AgentEvent } from '@ag2b/core';
import { act, renderHook } from '@testing-library/react';

import { makeAgent, wrapper } from '../../__tests__/fixtures';
import { useAg2bChat } from '../use-ag2b-chat';

describe('useAg2bChat', () => {
  it('starts idle with no response', () => {
    const agent = makeAgent();
    const { result } = renderHook(() => useAg2bChat(), { wrapper: wrapper(agent) });
    expect(result.current.response).toBeUndefined();
    expect(result.current.isPending).toBe(false);
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it('toggles isPending and sets response on success', async () => {
    const agent = makeAgent([{ content: 'pong', finishReason: 'stop' }]);
    const { result } = renderHook(() => useAg2bChat(), { wrapper: wrapper(agent) });

    let resolved: unknown;
    await act(async () => {
      resolved = await result.current.send('ping');
    });

    expect(resolved).toEqual({ content: 'pong', reasoning: undefined, finishReason: 'stop' });
    expect(result.current.response).toEqual({
      content: 'pong',
      reasoning: undefined,
      finishReason: 'stop',
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('captures errors thrown by the agent', async () => {
    const agent = makeAgent(); // no responses scripted → throws on chat
    const { result } = renderHook(() => useAg2bChat(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.isPending).toBe(false);
    expect(result.current.response).toBeUndefined();
  });

  it('aborts the previous send when called again', async () => {
    // Only one scripted response — the first send aborts before reaching the provider
    // (agent.loop() throws AbortError on signal check before the provider is called).
    // So only the second send actually calls the provider.
    const agent = makeAgent([{ content: 'second', finishReason: 'stop' }]);
    const { result } = renderHook(() => useAg2bChat(), { wrapper: wrapper(agent) });

    let firstPromise: Promise<unknown>;
    act(() => {
      firstPromise = result.current.send('first');
    });
    let secondPromise: Promise<unknown>;
    act(() => {
      secondPromise = result.current.send('second');
    });

    await act(async () => {
      const [first, second] = await Promise.all([firstPromise, secondPromise]);
      expect(first).toBeUndefined();
      expect(second).toEqual({
        content: 'second',
        reasoning: undefined,
        finishReason: 'stop',
      });
    });
  });

  it('abort() does not set error', async () => {
    const agent = makeAgent([{ content: 'late', finishReason: 'stop' }]);
    const { result } = renderHook(() => useAg2bChat(), { wrapper: wrapper(agent) });

    let started: Promise<unknown>;
    act(() => {
      started = result.current.send('hi');
    });
    act(() => result.current.abort());

    await act(async () => {
      await expect(started).resolves.toBeUndefined();
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });

  it('accumulates events during a successful send', async () => {
    const agent = makeAgent([{ content: 'pong', finishReason: 'stop' }]);
    const { result } = renderHook(() => useAg2bChat(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('ping');
    });

    expect(result.current.events.map((e: AgentEvent) => e.type)).toEqual([
      'agent_chat_start',
      'agent_content_delta',
      'agent_content_end',
      'agent_chat_done',
    ]);
  });

  it('resets events on the next send', async () => {
    const agent = makeAgent([
      { content: 'first', finishReason: 'stop' },
      { content: 'second', finishReason: 'stop' },
    ]);
    const { result } = renderHook(() => useAg2bChat(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('one');
    });
    expect(result.current.events.length).toBeGreaterThan(0);

    await act(async () => {
      await result.current.send('two');
    });
    expect(result.current.events.map((e: AgentEvent) => e.type)).toEqual([
      'agent_chat_start',
      'agent_content_delta',
      'agent_content_end',
      'agent_chat_done',
    ]);
  });

  it('isPending settles to false after a send', async () => {
    const agent = makeAgent([{ content: 'pong', finishReason: 'stop' }]);
    const { result } = renderHook(() => useAg2bChat(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('ping');
    });

    expect(result.current.isPending).toBe(false);
  });
});
