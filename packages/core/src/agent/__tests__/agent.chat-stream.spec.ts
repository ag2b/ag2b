import z from 'zod/v4';

import { Ag2bMaxIterationsError } from '@/errors';
import type { ProviderResponse } from '@/provider';
import { AbstractProvider } from '@/provider';
import { Tool } from '@/tool';

import { Agent } from '../agent';
import {
  collectStream,
  registerTools,
  ScriptedProvider,
  ScriptedStreamingProvider,
  sumTool,
  throwingTool,
} from './fixtures';

describe('Agent::chatStream', () => {
  it('yields content_end then stream_done for a no-tool-call response (sync provider fallback)', async () => {
    const provider = new ScriptedProvider([{ content: 'Hello', finishReason: 'stop' }]);
    const agent = new Agent({ provider });

    const events = await collectStream(agent, 'hi');

    expect(events).toEqual([
      { type: 'agent_chat_start', message: 'hi' },
      { type: 'agent_content_delta', delta: 'Hello' },
      { type: 'agent_content_end' },
      {
        type: 'agent_chat_done',
        response: { content: 'Hello', reasoning: undefined, finishReason: 'stop' },
      },
    ]);
  });

  it('terminates the stream after agent_chat_done (no hang)', async () => {
    const provider = new ScriptedProvider([{ content: 'bye', finishReason: 'stop' }]);
    const agent = new Agent({ provider });

    const events = await collectStream(agent, 'hi');

    // If the queue weren't ended, this for-await would hang; the test reaching here
    // proves it terminates. Last event is the stream_done.
    expect(events.at(-1)?.type).toBe('agent_chat_done');
  });

  it('emits tool start/end events and runs another iteration', async () => {
    const provider = new ScriptedStreamingProvider([
      [
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{"a":1,"b":2}',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ],
      [
        { type: 'provider_content_delta', delta: 'sum is 3' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ],
    ]);
    const agent = new Agent({ provider });
    registerTools(agent, sumTool());

    const events = await collectStream(agent, 'add');

    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'agent_chat_start',
      'agent_content_end',
      'agent_tool_call_start',
      'agent_tool_call_result',
      'agent_content_delta',
      'agent_content_end',
      'agent_chat_done',
    ]);

    const toolEnd = events.find((e) => e.type === 'agent_tool_call_result');
    expect(toolEnd).toMatchObject({ result: 3 });
  });

  it('emits agent_tool_call_error when the handler throws and continues the loop', async () => {
    const provider = new ScriptedStreamingProvider([
      [
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'broken',
          argumentsDelta: '{}',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ],
      [
        { type: 'provider_content_delta', delta: 'sorry' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ],
    ]);
    const agent = new Agent({ provider });
    const handlerError = new Error('handler boom');
    registerTools(agent, throwingTool(handlerError));

    const events = await collectStream(agent, 'go');

    const failed = events.find((e) => e.type === 'agent_tool_call_error');
    expect(failed).toBeDefined();
    expect((failed as { error: unknown }).error).toBe(handlerError);
    expect(events.at(-1)?.type).toBe('agent_chat_done');
  });

  it('propagates a provider error to the consumer', async () => {
    class FailingProvider extends AbstractProvider {
      constructor() {
        super({ baseURL: '/x' });
      }
      protected runChat(): Promise<ProviderResponse> {
        throw new Error('not used — chat is overridden');
      }
      override chat(): Promise<ProviderResponse> {
        return Promise.reject(new Error('provider down'));
      }
    }
    const agent = new Agent({ provider: new FailingProvider() });

    await expect(collectStream(agent, 'hi')).rejects.toThrow('provider down');
  });

  it('terminates the stream when signal aborts before the first iteration', async () => {
    const provider = new ScriptedProvider([{ content: 'unused', finishReason: 'stop' }]);
    const agent = new Agent({ provider });
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));

    await expect(collectStream(agent, 'hi', controller.signal)).rejects.toThrow('cancelled');
    expect(provider.calls).toHaveLength(0);
  });

  it('passes provider_reasoning_delta through as agent_reasoning_delta + agent_reasoning_end', async () => {
    const provider = new ScriptedStreamingProvider([
      [
        { type: 'provider_reasoning_delta', delta: 'thinking…' },
        { type: 'provider_content_delta', delta: 'answer' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ],
    ]);
    const agent = new Agent({ provider });

    const events = await collectStream(agent, 'hi');

    expect(events.map((e) => e.type)).toEqual([
      'agent_chat_start',
      'agent_reasoning_delta',
      'agent_reasoning_end',
      'agent_content_delta',
      'agent_content_end',
      'agent_chat_done',
    ]);
  });

  it('handles multiple parallel tool calls in a single iteration', async () => {
    const provider = new ScriptedStreamingProvider([
      [
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{"a":1,"b":2}',
        },
        {
          type: 'provider_tool_call_delta',
          index: 1,
          id: 'c2',
          name: 'sum',
          argumentsDelta: '{"a":3,"b":4}',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ],
      [
        { type: 'provider_content_delta', delta: 'done' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ],
    ]);
    const agent = new Agent({ provider });
    registerTools(agent, sumTool());

    const events = await collectStream(agent, 'add both');

    const starts = events.filter((e) => e.type === 'agent_tool_call_start');
    const ends = events.filter((e) => e.type === 'agent_tool_call_result');
    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
    expect(ends.map((e) => (e as { result: unknown }).result)).toEqual([3, 7]);
  });

  it('terminates the stream when signal aborts between iterations', async () => {
    const controller = new AbortController();
    const provider = new ScriptedStreamingProvider([
      [
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{"a":1,"b":2}',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ],
      [
        { type: 'provider_content_delta', delta: 'never reached' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ],
    ]);
    const agent = new Agent({ provider });
    registerTools(
      agent,
      new Tool({
        name: 'sum',
        description: 's',
        parameters: z.object({ a: z.number(), b: z.number() }),
        handler: ({ a, b }) => {
          controller.abort(new Error('between'));
          return a + b;
        },
      })
    );

    await expect(collectStream(agent, 'go', controller.signal)).rejects.toThrow('between');
    expect(provider.calls).toHaveLength(1);
  });

  it('throws Ag2bMaxIterationsError into the consumer queue', async () => {
    const provider = new ScriptedStreamingProvider(
      Array.from({ length: 5 }, () => [
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{"a":1,"b":1}',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' as const },
      ])
    );
    const agent = new Agent({ provider, maxIterations: 2 });
    registerTools(agent, sumTool());

    await expect(collectStream(agent, 'go')).rejects.toThrow(Ag2bMaxIterationsError);
  });

  it('streams content and runs a tool call in the same iteration', async () => {
    const provider = new ScriptedStreamingProvider([
      [
        { type: 'provider_content_delta', delta: 'thinking ' },
        { type: 'provider_content_delta', delta: 'about it' },
        {
          type: 'provider_tool_call_delta',
          index: 0,
          id: 'c1',
          name: 'sum',
          argumentsDelta: '{"a":1,"b":2}',
        },
        { type: 'provider_stream_done', finishReason: 'tool_calls' },
      ],
      [
        { type: 'provider_content_delta', delta: 'final' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ],
    ]);
    const agent = new Agent({ provider });
    registerTools(agent, sumTool());

    const events = await collectStream(agent, 'go');

    expect(events.filter((e) => e.type === 'agent_content_delta')).toHaveLength(3);
    expect(events.filter((e) => e.type === 'agent_tool_call_result')).toHaveLength(1);
    expect(events.at(-1)?.type).toBe('agent_chat_done');
  });
});
