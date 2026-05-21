import z from 'zod/v4';

import { Ag2bMaxIterationsError } from '@/errors';
import type { ProviderResponse } from '@/provider';
import { AbstractProvider } from '@/provider';
import { Scope } from '@/scope';
import { Tool } from '@/tool';

import { Agent, createAgent } from '../agent';
import type { AgentEvent } from '../event';
import { registerTools, ScriptedProvider, sumTool, throwingTool } from './fixtures';

describe('Agent::chat', () => {
  it('returns the final response when provider replies with no tool calls', async () => {
    const provider = new ScriptedProvider([{ content: 'Hello!', finishReason: 'stop' }]);
    const agent = new Agent({ provider });

    const response = await agent.chat('Hi');

    expect(response).toEqual({
      content: 'Hello!',
      reasoning: undefined,
      finishReason: 'stop',
    });
  });

  it('includes reasoning in the response', async () => {
    const provider = new ScriptedProvider([
      { content: 'Done', reasoning: 'thinking…', finishReason: 'stop' },
    ]);
    const agent = new Agent({ provider });

    const response = await agent.chat('Hi');

    expect(response.reasoning).toBe('thinking…');
  });

  it('appends user message to history before calling the provider', async () => {
    const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
    const agent = new Agent({ provider });

    await agent.chat('hello');

    expect(provider.calls[0]?.request.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(agent.history.getSnapshot()[0]).toEqual({ role: 'user', content: 'hello' });
  });

  it('appends assistant response to history', async () => {
    const provider = new ScriptedProvider([{ content: 'reply', finishReason: 'stop' }]);
    const agent = new Agent({ provider });

    await agent.chat('hi');

    expect(agent.history.getSnapshot()[1]).toMatchObject({
      role: 'assistant',
      content: 'reply',
    });
  });

  it('forwards system prompt and active tools (from registered scopes) to the provider', async () => {
    const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
    const agent = new Agent({ provider, system: 'You are helpful' });
    const tool = sumTool();
    registerTools(agent, tool);

    await agent.chat('hi');

    expect(provider.calls[0]?.request.system).toBe('You are helpful');
    expect(provider.calls[0]?.request.tools).toEqual([tool]);
  });

  it('omits tools from a disabled scope when calling the provider', async () => {
    const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
    const agent = new Agent({ provider });
    agent.scopes.register(new Scope({ name: 'cart', enabled: () => false, tools: [sumTool()] }));

    await agent.chat('hi');

    expect(provider.calls[0]?.request.tools).toEqual([]);
  });

  it('forwards the AbortSignal to the provider', async () => {
    const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
    const agent = new Agent({ provider });
    const controller = new AbortController();

    await agent.chat('hi', { signal: controller.signal });

    expect(provider.calls[0]?.signal).toBe(controller.signal);
  });

  it('runs another iteration after a tool call and returns the second response', async () => {
    const provider = new ScriptedProvider([
      {
        calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
        finishReason: 'tool_calls',
      },
      { content: 'sum is 3', finishReason: 'stop' },
    ]);
    const agent = new Agent({ provider });
    registerTools(agent, sumTool());

    const response = await agent.chat('add');

    expect(response.content).toBe('sum is 3');
    const history = agent.history.getSnapshot();
    expect(history).toHaveLength(4);
    expect(history[2]).toEqual({ role: 'tool', id: 'c1', content: '3' });
  });

  it('serializes a void tool handler result as the JSON string "null"', async () => {
    // Regression: JSON.stringify(undefined) returns the value `undefined`, not
    // a string. Without a fallback, the tool message would carry content:undefined
    // and providers like OpenAI reject it ("'content' field must be a string…").
    const provider = new ScriptedProvider([
      {
        calls: [{ id: 'c1', name: 'void', arguments: {} }],
        finishReason: 'tool_calls',
      },
      { content: 'done', finishReason: 'stop' },
    ]);
    const agent = new Agent({ provider });
    registerTools(
      agent,
      new Tool({
        name: 'void',
        description: 'Returns nothing',
        parameters: z.object({}),
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        handler: () => {},
      })
    );

    await agent.chat('go');

    const history = agent.history.getSnapshot();
    expect(history[2]).toEqual({ role: 'tool', id: 'c1', content: 'null' });
    const followupMessages = provider.calls[1]?.request.messages;
    expect(followupMessages?.find((m) => m.role === 'tool')).toEqual({
      role: 'tool',
      id: 'c1',
      content: 'null',
    });
  });

  it('serializes a tool handler error into the history result', async () => {
    const provider = new ScriptedProvider([
      {
        calls: [{ id: 'c1', name: 'broken', arguments: {} }],
        finishReason: 'tool_calls',
      },
      { content: 'sorry', finishReason: 'stop' },
    ]);
    const agent = new Agent({ provider });
    registerTools(agent, throwingTool(new Error('blew up')));

    await agent.chat('go');

    const history = agent.history.getSnapshot();
    const toolMessage = history.find((m) => m.role === 'tool');
    expect(toolMessage).toBeDefined();
    const parsed = JSON.parse((toolMessage as { content: string }).content) as {
      error: { name: string; message: string };
    };
    expect(parsed.error).toEqual({ name: 'Error', message: 'blew up' });
  });

  it('serializes Ag2bUnknownToolError into history when the LLM names a tool that is not registered', async () => {
    const provider = new ScriptedProvider([
      {
        calls: [{ id: 'c1', name: 'ghost', arguments: {} }],
        finishReason: 'tool_calls',
      },
      { content: 'oops', finishReason: 'stop' },
    ]);
    const agent = new Agent({ provider });

    await agent.chat('go');

    const toolMessage = agent.history.getSnapshot().find((m) => m.role === 'tool');
    const parsed = JSON.parse((toolMessage as { content: string }).content) as {
      error: { name: string; message: string };
    };
    expect(parsed.error.name).toBe('Ag2bUnknownToolError');
    expect(parsed.error.message).toBe('Unknown tool "ghost"');
  });

  it('serializes Ag2bDisabledToolError into history when the LLM calls a tool whose scope is currently disabled', async () => {
    const provider = new ScriptedProvider([
      {
        calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
        finishReason: 'tool_calls',
      },
      { content: 'recovered', finishReason: 'stop' },
    ]);
    const agent = new Agent({ provider });
    agent.scopes.register(new Scope({ name: 'cart', enabled: () => false, tools: [sumTool()] }));

    await agent.chat('add');

    const toolMessage = agent.history.getSnapshot().find((m) => m.role === 'tool');
    const parsed = JSON.parse((toolMessage as { content: string }).content) as {
      error: { name: string; message: string };
    };
    expect(parsed.error.name).toBe('Ag2bDisabledToolError');
    expect(parsed.error.message).toBe('Tool "sum" is currently unavailable');
  });

  it('throws Ag2bMaxIterationsError when the loop exceeds maxIterations', async () => {
    const provider = new ScriptedProvider(
      Array.from({ length: 10 }, () => ({
        calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 1 } }],
        finishReason: 'tool_calls' as const,
      }))
    );
    const agent = new Agent({ provider, maxIterations: 3 });
    registerTools(agent, sumTool());

    await expect(agent.chat('go')).rejects.toThrow(Ag2bMaxIterationsError);
  });

  it('throws immediately when signal is already aborted', async () => {
    const provider = new ScriptedProvider([{ content: 'unused', finishReason: 'stop' }]);
    const agent = new Agent({ provider });
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));

    await expect(agent.chat('hi', { signal: controller.signal })).rejects.toThrow('cancelled');
    expect(provider.calls).toHaveLength(0);
  });

  it('checks abort between iterations', async () => {
    const controller = new AbortController();
    const provider = new ScriptedProvider([
      {
        calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
        finishReason: 'tool_calls',
      },
      { content: 'never reached', finishReason: 'stop' },
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

    await expect(agent.chat('go', { signal: controller.signal })).rejects.toThrow('between');
    expect(provider.calls).toHaveLength(1);
  });
});

describe('agent.chat({ onEvent })', () => {
  it('invokes onEvent with lifecycle events in loop order', async () => {
    const provider = new ScriptedProvider([{ content: 'pong', finishReason: 'stop' }]);
    const agent = createAgent({ provider });

    const events: AgentEvent[] = [];
    await agent.chat('ping', { onEvent: (e) => events.push(e) });

    expect(events.map((e) => e.type)).toEqual([
      'agent_chat_start',
      'agent_content_delta',
      'agent_content_end',
      'agent_chat_done',
    ]);
  });

  it('agent_chat_start carries the user message', async () => {
    const provider = new ScriptedProvider([{ content: 'pong', finishReason: 'stop' }]);
    const agent = createAgent({ provider });

    const events: AgentEvent[] = [];
    await agent.chat('ping', { onEvent: (e) => events.push(e) });

    const start = events.find((e) => e.type === 'agent_chat_start');
    expect(start).toEqual({ type: 'agent_chat_start', message: 'ping' });
  });

  it('emits agent_chat_abort instead of agent_chat_done when aborted', async () => {
    const provider = new ScriptedProvider([{ content: 'unused', finishReason: 'stop' }]);
    const agent = createAgent({ provider });
    const reason = new Error('cancelled');
    const controller = new AbortController();
    controller.abort(reason);

    const events: AgentEvent[] = [];
    await expect(
      agent.chat('hi', { signal: controller.signal, onEvent: (e) => events.push(e) })
    ).rejects.toThrow('cancelled');

    expect(events.map((e) => e.type)).toEqual(['agent_chat_start', 'agent_chat_abort']);
    expect(events.at(-1)).toEqual({ type: 'agent_chat_abort', reason });
  });

  it('emits agent_chat_error on non-abort failure', async () => {
    class FailingProvider extends AbstractProvider {
      constructor() {
        super({ baseURL: '/x' });
      }
      protected runChat(): Promise<ProviderResponse> {
        throw new Error('not used');
      }
      override chat(): Promise<ProviderResponse> {
        return Promise.reject(new Error('provider down'));
      }
    }
    const agent = createAgent({ provider: new FailingProvider() });

    const events: AgentEvent[] = [];
    await expect(agent.chat('hi', { onEvent: (e) => events.push(e) })).rejects.toThrow(
      'provider down'
    );

    expect(events.map((e) => e.type)).toEqual(['agent_chat_start', 'agent_chat_error']);
    const last = events.at(-1) as Extract<AgentEvent, { type: 'agent_chat_error' }>;
    expect((last.error as Error).message).toBe('provider down');
  });

  it('emits tool_call boundary events for tool-calling turns', async () => {
    const provider = new ScriptedProvider([
      {
        content: undefined,
        finishReason: 'tool_calls',
        calls: [{ id: 'c1', name: 'echo', arguments: { x: 1 } }],
      },
      { content: 'done', finishReason: 'stop' },
    ]);
    const agent = createAgent({ provider });
    agent.scopes.register(
      new Scope({
        name: 's',
        tools: [
          new Tool({
            name: 'echo',
            description: '',
            parameters: z.object({ x: z.number() }),
            // eslint-disable-next-line @typescript-eslint/require-await
            handler: async ({ x }) => ({ x }),
          }),
        ],
      })
    );

    const events: AgentEvent[] = [];
    await agent.chat('go', { onEvent: (e) => events.push(e) });

    expect(events.map((e) => e.type)).toEqual([
      'agent_chat_start',
      'agent_content_end',
      'agent_tool_call_start',
      'agent_tool_call_result',
      'agent_content_delta',
      'agent_content_end',
      'agent_chat_done',
    ]);
  });

  it('emits reasoning + content deltas under sync caller', async () => {
    const provider = new ScriptedProvider([
      { content: 'pong', reasoning: 'thinking', finishReason: 'stop' },
    ]);
    const agent = createAgent({ provider });

    const events: AgentEvent[] = [];
    await agent.chat('ping', { onEvent: (e) => events.push(e) });

    expect(events.map((e) => e.type)).toEqual([
      'agent_chat_start',
      'agent_reasoning_delta',
      'agent_reasoning_end',
      'agent_content_delta',
      'agent_content_end',
      'agent_chat_done',
    ]);
  });

  it('works without onEvent', async () => {
    const provider = new ScriptedProvider([{ content: 'pong', finishReason: 'stop' }]);
    const agent = createAgent({ provider });

    const result = await agent.chat('ping');
    expect(result).toEqual({ content: 'pong', reasoning: undefined, finishReason: 'stop' });
  });

  it('passes options.signal through to the loop', async () => {
    const provider = new ScriptedProvider([{ content: 'pong', finishReason: 'stop' }]);
    const agent = createAgent({ provider });

    const controller = new AbortController();
    controller.abort();

    await expect(agent.chat('ping', { signal: controller.signal })).rejects.toThrow();
  });
});
