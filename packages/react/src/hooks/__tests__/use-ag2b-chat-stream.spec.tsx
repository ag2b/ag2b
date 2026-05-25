import type { ProviderStreamChunk } from '@ag2b/core';
import { Scope, Tool } from '@ag2b/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import z from 'zod/v4';

import { makeStreamingAgent, wrapper } from '../../__tests__/fixtures';
import { useAg2bChatStream } from '../use-ag2b-chat-stream';

const okStream: ProviderStreamChunk[] = [
  { type: 'provider_content_delta', delta: 'hel' },
  { type: 'provider_content_delta', delta: 'lo' },
  { type: 'provider_stream_done', finishReason: 'stop' },
];

const reasoningStream: ProviderStreamChunk[] = [
  { type: 'provider_reasoning_delta', delta: 'thinking…' },
  { type: 'provider_content_delta', delta: 'done' },
  { type: 'provider_stream_done', finishReason: 'stop' },
];

describe('useAg2bChatStream', () => {
  it('starts idle with no pendingMessage', () => {
    const agent = makeStreamingAgent();
    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });
    expect(result.current.pendingMessage).toBeNull();
    expect(result.current.events).toEqual([]);
    expect(result.current.isPending).toBe(false);
    expect(result.current.response).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('resolves with the final response and clears pendingMessage after agent_chat_done', async () => {
    const agent = makeStreamingAgent([okStream]);
    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    let resolved: unknown;
    await act(async () => {
      resolved = await result.current.send('hi');
    });

    expect(result.current.pendingMessage).toBeNull();
    expect(result.current.response).toMatchObject({ content: 'hello', finishReason: 'stop' });
    expect(result.current.isPending).toBe(false);
    expect(resolved).toMatchObject({ content: 'hello', finishReason: 'stop' });
  });

  it('exposes reasoning and content separately in response', async () => {
    const agent = makeStreamingAgent([reasoningStream]);
    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.pendingMessage).toBeNull();
    expect(result.current.response).toEqual({
      content: 'done',
      reasoning: 'thinking…',
      finishReason: 'stop',
    });
  });

  it('does not leak previous send state into the next send', async () => {
    const agent = makeStreamingAgent([okStream, okStream]);
    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('one');
    });
    expect(result.current.response).toMatchObject({ content: 'hello' });
    const firstEventCount = result.current.events.length;
    expect(firstEventCount).toBeGreaterThan(0);

    await act(async () => {
      await result.current.send('two');
    });
    expect(result.current.events.length).toBe(firstEventCount);
    expect(result.current.response).toMatchObject({ content: 'hello' });
  });

  it('records every event in order', async () => {
    const agent = makeStreamingAgent([okStream]);
    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('hi');
    });

    const types = result.current.events.map((e) => e.type);
    expect(types).toContain('agent_content_delta');
    expect(types).toContain('agent_chat_done');
  });

  it('captures stream errors in error state', async () => {
    const agent = makeStreamingAgent();
    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.isPending).toBe(false);
  });

  it('records an error if the stream ends without agent_chat_done', async () => {
    const agent = makeStreamingAgent();
    // eslint-disable-next-line @typescript-eslint/require-await
    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_content_delta', delta: 'partial' };
      // intentionally no agent_chat_done — simulates a misbehaving agent/provider
    });

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toMatch(/agent_chat_done/);
    expect(result.current.isPending).toBe(false);
  });

  it('exposes pendingMessage with the current delta while the stream is in flight', async () => {
    const agent = makeStreamingAgent();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_chat_start', message: 'hi' };
      yield { type: 'agent_content_delta', delta: 'Hello' };
      yield { type: 'agent_content_delta', delta: ' world' };
      await gate;
      yield { type: 'agent_content_end' };
      yield {
        type: 'agent_chat_done',
        response: { content: 'Hello world', finishReason: 'stop' },
      };
    });

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    let sendPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      sendPromise = result.current.send('hi');
    });

    await waitFor(() =>
      expect(result.current.pendingMessage).toEqual({
        role: 'assistant',
        content: 'Hello world',
        reasoning: undefined,
      })
    );
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      release();
      await sendPromise;
    });

    expect(result.current.pendingMessage).toBeNull();
    expect(result.current.isPending).toBe(false);
    expect(result.current.response).toMatchObject({ content: 'Hello world' });
  });

  it('pendingMessage carries reasoning with undefined content when only reasoning has streamed', async () => {
    const agent = makeStreamingAgent();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_chat_start', message: 'hi' };
      yield { type: 'agent_reasoning_delta', delta: 'thinking…' };
      await gate;
      yield { type: 'agent_reasoning_end' };
      yield { type: 'agent_content_delta', delta: 'done' };
      yield { type: 'agent_content_end' };
      yield {
        type: 'agent_chat_done',
        response: { content: 'done', reasoning: 'thinking…', finishReason: 'stop' },
      };
    });

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    let sendPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      sendPromise = result.current.send('hi');
    });

    await waitFor(() =>
      expect(result.current.pendingMessage).toEqual({
        role: 'assistant',
        content: undefined,
        reasoning: 'thinking…',
      })
    );

    await act(async () => {
      release();
      await sendPromise;
    });
  });

  it("response carries the final iteration's text after multi-iteration send", async () => {
    const iter0Chunks: ProviderStreamChunk[] = [
      { type: 'provider_reasoning_delta', delta: 'thinking 0' },
      { type: 'provider_content_delta', delta: "I'll check" },
      {
        type: 'provider_tool_call_delta',
        index: 0,
        id: 'a',
        name: 'echo',
        argumentsDelta: '{"x":1}',
      },
      { type: 'provider_stream_done', finishReason: 'tool_calls' },
    ];
    const iter1Chunks: ProviderStreamChunk[] = [
      { type: 'provider_reasoning_delta', delta: 'thinking 1' },
      { type: 'provider_content_delta', delta: 'Weather is 72' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ];

    const agent = makeStreamingAgent([iter0Chunks, iter1Chunks]);
    agent.scopes.register(
      new Scope({
        name: 's',
        tools: [
          new Tool({
            name: 'echo',
            description: '',
            parameters: z.object({ x: z.number() }),
            // eslint-disable-next-line @typescript-eslint/require-await
            handler: async ({ x }: { x: number }) => ({ x }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('go');
    });

    expect(result.current.pendingMessage).toBeNull();
    expect(result.current.response).toEqual({
      content: 'Weather is 72',
      reasoning: 'thinking 1',
      finishReason: 'stop',
    });
  });

  it('cross-field clear at iteration boundary survives in response', async () => {
    // Iteration 0: reasoning + content + tool_call.
    // Iteration 1: content only (no reasoning).
    // Verifies the internal pendingReset logic still resets the accumulators
    // so the final response reflects iter1 only.
    const iter0Chunks: ProviderStreamChunk[] = [
      { type: 'provider_reasoning_delta', delta: 'iter0 reasoning' },
      { type: 'provider_content_delta', delta: 'iter0 content' },
      {
        type: 'provider_tool_call_delta',
        index: 0,
        id: 'a',
        name: 'echo',
        argumentsDelta: '{"x":1}',
      },
      { type: 'provider_stream_done', finishReason: 'tool_calls' },
    ];
    const iter1Chunks: ProviderStreamChunk[] = [
      { type: 'provider_content_delta', delta: 'iter1 content' },
      { type: 'provider_stream_done', finishReason: 'stop' },
    ];

    const agent = makeStreamingAgent([iter0Chunks, iter1Chunks]);
    agent.scopes.register(
      new Scope({
        name: 's',
        tools: [
          new Tool({
            name: 'echo',
            description: '',
            parameters: z.object({ x: z.number() }),
            // eslint-disable-next-line @typescript-eslint/require-await
            handler: async ({ x }: { x: number }) => ({ x }),
          }),
        ],
      })
    );

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    await act(async () => {
      await result.current.send('go');
    });

    expect(result.current.pendingMessage).toBeNull();
    expect(result.current.response).toMatchObject({
      content: 'iter1 content',
      finishReason: 'stop',
    });
    expect(result.current.response?.reasoning).toBeUndefined();
  });

  it('exposes streamed tool calls in pendingMessage.calls before they commit', async () => {
    const agent = makeStreamingAgent();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_chat_start', message: 'go' };
      yield {
        type: 'agent_tool_call_delta',
        index: 0,
        id: 'c1',
        name: 'echo',
        argumentsDelta: '{"x":',
      };
      yield { type: 'agent_tool_call_delta', index: 0, argumentsDelta: '1}' };
      await gate;
      yield { type: 'agent_content_end' };
      yield { type: 'agent_chat_done', response: { finishReason: 'tool_calls' } };
    });

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    let sendPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      sendPromise = result.current.send('go');
    });

    await waitFor(() =>
      expect(result.current.pendingMessage).toEqual({
        role: 'assistant',
        content: undefined,
        reasoning: undefined,
        calls: [{ id: 'c1', name: 'echo', arguments: { x: 1 } }],
      })
    );

    await act(async () => {
      release();
      await sendPromise;
    });

    expect(result.current.pendingMessage).toBeNull();
  });

  it('surfaces a tool call with empty args while its arguments are still partial JSON', async () => {
    const agent = makeStreamingAgent();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_chat_start', message: 'go' };
      yield {
        type: 'agent_tool_call_delta',
        index: 0,
        id: 'c1',
        name: 'echo',
        argumentsDelta: '{"x":',
      };
      await gate;
      yield { type: 'agent_content_end' };
      yield { type: 'agent_chat_done', response: { finishReason: 'tool_calls' } };
    });

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    let sendPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      sendPromise = result.current.send('go');
    });

    await waitFor(() =>
      expect(result.current.pendingMessage?.calls).toEqual([
        { id: 'c1', name: 'echo', arguments: {} },
      ])
    );

    await act(async () => {
      release();
      await sendPromise;
    });
  });

  it('starts a fresh tool-call buffer when a new turn begins with a tool call', async () => {
    const agent = makeStreamingAgent();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Two iterations, each a tool-call-only turn. Tool indices reset per turn,
    // so iteration 2's index-0 delta must NOT merge into (or be dropped by) the
    // committed first-turn call — the pending buffer has to start fresh.
    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_chat_start', message: 'go' };
      yield {
        type: 'agent_tool_call_delta',
        index: 0,
        id: 'c1',
        name: 'first',
        argumentsDelta: '{}',
      };
      yield { type: 'agent_content_end' };
      yield { type: 'agent_tool_call_start', call: { id: 'c1', name: 'first', arguments: {} } };
      yield {
        type: 'agent_tool_call_result',
        call: { id: 'c1', name: 'first', arguments: {} },
        result: null,
      };
      yield {
        type: 'agent_tool_call_delta',
        index: 0,
        id: 'c2',
        name: 'second',
        argumentsDelta: '{"y":2}',
      };
      await gate;
      yield { type: 'agent_content_end' };
      yield { type: 'agent_chat_done', response: { finishReason: 'tool_calls' } };
    });

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    let sendPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      sendPromise = result.current.send('go');
    });

    await waitFor(() =>
      expect(result.current.pendingMessage?.calls).toEqual([
        { id: 'c2', name: 'second', arguments: { y: 2 } },
      ])
    );

    await act(async () => {
      release();
      await sendPromise;
    });
  });

  it("resets content to the new turn's delta when a turn begins with content", async () => {
    const agent = makeStreamingAgent();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Iteration 1 produces content + a tool call; iteration 2 opens with content.
    // The pending turn must show only iteration 2's content — not appended to
    // iteration 1's text, and not blanked out.
    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_chat_start', message: 'go' };
      yield { type: 'agent_content_delta', delta: 'first' };
      yield { type: 'agent_tool_call_delta', index: 0, id: 'c1', name: 't', argumentsDelta: '{}' };
      yield { type: 'agent_content_end' };
      yield { type: 'agent_tool_call_start', call: { id: 'c1', name: 't', arguments: {} } };
      yield {
        type: 'agent_tool_call_result',
        call: { id: 'c1', name: 't', arguments: {} },
        result: null,
      };
      yield { type: 'agent_content_delta', delta: 'second' };
      await gate;
      yield { type: 'agent_content_end' };
      yield { type: 'agent_chat_done', response: { content: 'second', finishReason: 'stop' } };
    });

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    let sendPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      sendPromise = result.current.send('go');
    });

    await waitFor(() =>
      expect(result.current.pendingMessage).toEqual({
        role: 'assistant',
        content: 'second',
        reasoning: undefined,
        calls: undefined,
      })
    );

    await act(async () => {
      release();
      await sendPromise;
    });
  });

  it("resets reasoning to the new turn's delta when a turn begins with reasoning", async () => {
    const agent = makeStreamingAgent();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Iteration 1 produces reasoning + content; iteration 2 opens with reasoning.
    // The pending turn must show only iteration 2's reasoning, with the prior
    // turn's content cleared.
    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_chat_start', message: 'go' };
      yield { type: 'agent_reasoning_delta', delta: 'think1' };
      yield { type: 'agent_reasoning_end' };
      yield { type: 'agent_content_delta', delta: 'first' };
      yield { type: 'agent_tool_call_delta', index: 0, id: 'c1', name: 't', argumentsDelta: '{}' };
      yield { type: 'agent_content_end' };
      yield { type: 'agent_tool_call_start', call: { id: 'c1', name: 't', arguments: {} } };
      yield {
        type: 'agent_tool_call_result',
        call: { id: 'c1', name: 't', arguments: {} },
        result: null,
      };
      yield { type: 'agent_reasoning_delta', delta: 'think2' };
      await gate;
      yield { type: 'agent_reasoning_end' };
      yield { type: 'agent_content_delta', delta: 'second' };
      yield { type: 'agent_content_end' };
      yield { type: 'agent_chat_done', response: { content: 'second', finishReason: 'stop' } };
    });

    const { result } = renderHook(() => useAg2bChatStream(), { wrapper: wrapper(agent) });

    let sendPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      sendPromise = result.current.send('go');
    });

    await waitFor(() =>
      expect(result.current.pendingMessage).toEqual({
        role: 'assistant',
        content: undefined,
        reasoning: 'think2',
        calls: undefined,
      })
    );

    await act(async () => {
      release();
      await sendPromise;
    });
  });
});
