import z from 'zod/v4';

import { Ag2bMaxIterationsError } from '@/errors';
import type { ProviderResponse } from '@/provider';
import { AbstractProvider } from '@/provider';
import { Scope } from '@/scope';
import { Tool } from '@/tool';

import { Agent } from '../agent';
import { collectStream, registerTools, ScriptedProvider, sumTool, throwingTool } from './fixtures';

describe('Agent::Hooks', () => {
  describe('Agent::Hooks::onChatStart', () => {
    it('fires once with { message, signal } before any provider call', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const fn = vi.fn();
      agent.addHook('onChatStart', fn);
      const signal = new AbortController().signal;

      await agent.chat('hi', { signal });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({ message: 'hi', signal });
    });

    it('fires before the user message lands in history', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      let historyAtHook: number | undefined;
      agent.addHook('onChatStart', () => {
        historyAtHook = agent.history.getSnapshot().length;
      });

      await agent.chat('hi');
      expect(historyAtHook).toBe(0);
    });

    it('fires for chatStream too', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const fn = vi.fn();
      agent.addHook('onChatStart', fn);

      await collectStream(agent, 'hi');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Agent::Hooks::onChatDone', () => {
    it('fires once on success with the final response', async () => {
      const provider = new ScriptedProvider([
        { content: 'done', reasoning: 'why', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      const fn = vi.fn();
      agent.addHook('onChatDone', fn);

      await agent.chat('hi');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({
        response: { content: 'done', reasoning: 'why', finishReason: 'stop' },
      });
    });

    it('does NOT fire when chat errors', async () => {
      class FailingProvider extends AbstractProvider {
        constructor() {
          super({ baseURL: '/x' });
        }
        protected runChat(): Promise<ProviderResponse> {
          throw new Error('not used');
        }
        override chat(): Promise<ProviderResponse> {
          return Promise.reject(new Error('boom'));
        }
      }
      const agent = new Agent({ provider: new FailingProvider() });
      const fn = vi.fn();
      agent.addHook('onChatDone', fn);

      await expect(agent.chat('hi')).rejects.toThrow('boom');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('Agent::Hooks::onChatError', () => {
    it('fires on provider error', async () => {
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
      const agent = new Agent({ provider: new FailingProvider() });
      const fn = vi.fn();
      agent.addHook('onChatError', fn);

      await expect(agent.chat('hi')).rejects.toThrow('provider down');
      expect(fn).toHaveBeenCalledTimes(1);
      const ctx = fn.mock.calls[0]?.[0] as { error: Error };
      expect(ctx.error.message).toBe('provider down');
    });

    it('does NOT fire on abort signal (routes to onChatAbort)', async () => {
      const provider = new ScriptedProvider([{ content: 'unused', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const fn = vi.fn();
      agent.addHook('onChatError', fn);
      const controller = new AbortController();
      controller.abort(new Error('cancelled'));

      await expect(agent.chat('hi', { signal: controller.signal })).rejects.toThrow('cancelled');
      expect(fn).not.toHaveBeenCalled();
    });

    it('fires on Ag2bMaxIterationsError', async () => {
      const provider = new ScriptedProvider(
        Array.from({ length: 5 }, () => ({
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 1 } }],
          finishReason: 'tool_calls' as const,
        }))
      );
      const agent = new Agent({ provider, maxIterations: 2 });
      registerTools(agent, sumTool());
      const fn = vi.fn();
      agent.addHook('onChatError', fn);

      await expect(agent.chat('go')).rejects.toThrow(Ag2bMaxIterationsError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('fires on hook throw', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const onError = vi.fn();
      agent.addHook('preRequest', () => {
        throw new Error('hook boom');
      });
      agent.addHook('onChatError', onError);

      await expect(agent.chat('hi')).rejects.toThrow('hook boom');
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire when chat succeeds', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const fn = vi.fn();
      agent.addHook('onChatError', fn);

      await agent.chat('hi');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('Agent::Hooks::onChatAbort', () => {
    it('fires on abort signal and receives signal.reason', async () => {
      const provider = new ScriptedProvider([{ content: 'unused', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const fn = vi.fn();
      agent.addHook('onChatAbort', fn);
      const reason = new Error('cancelled');
      const controller = new AbortController();
      controller.abort(reason);

      await expect(agent.chat('hi', { signal: controller.signal })).rejects.toThrow('cancelled');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0]?.[0]).toEqual({ reason });
    });

    it('does NOT fire on non-abort errors (routes to onChatError)', async () => {
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
      const agent = new Agent({ provider: new FailingProvider() });
      const fn = vi.fn();
      agent.addHook('onChatAbort', fn);

      await expect(agent.chat('hi')).rejects.toThrow('provider down');
      expect(fn).not.toHaveBeenCalled();
    });

    it('hook throw is caught and ignored, original abort still propagates', async () => {
      const provider = new ScriptedProvider([{ content: 'unused', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      agent.addHook('onChatAbort', () => {
        throw new Error('hook boom');
      });
      const controller = new AbortController();
      controller.abort(new Error('cancelled'));

      await expect(agent.chat('hi', { signal: controller.signal })).rejects.toThrow('cancelled');
    });
  });

  describe('Agent::Hooks::onMessage', () => {
    it('fires for user, assistant, and tool messages in correct order', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'reply', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      registerTools(agent, sumTool());

      const seen: string[] = [];
      agent.addHook('onMessage', (ctx) => {
        seen.push(ctx.message.role);
      });

      await agent.chat('add');

      expect(seen).toEqual(['user', 'assistant', 'tool', 'assistant']);
    });

    it('fires AFTER the message lands in history', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const lengths: number[] = [];
      agent.addHook('onMessage', () => {
        lengths.push(agent.history.getSnapshot().length);
      });

      await agent.chat('hi');
      expect(lengths).toEqual([1, 2]);
    });
  });

  describe('Agent::Hooks::preRequest', () => {
    it('fires per iteration with iteration index, request, and signal', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      registerTools(agent, sumTool());

      const iterations: number[] = [];
      agent.addHook('preRequest', (ctx) => {
        iterations.push(ctx.iteration);
      });

      await agent.chat('go');
      expect(iterations).toEqual([0, 1]);
    });

    it('mutating request via { request } affects what the provider receives', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      agent.addHook('preRequest', (ctx) => ({
        request: { ...ctx.request, system: 'INJECTED' },
      }));

      await agent.chat('hi');

      expect(provider.calls[0]?.request.system).toBe('INJECTED');
    });

    it('short-circuit with { response } skips the provider call', async () => {
      const provider = new ScriptedProvider([{ content: 'never', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      agent.addHook('preRequest', () => ({
        response: { content: 'cached', finishReason: 'stop' },
      }));

      const response = await agent.chat('hi');

      expect(response.content).toBe('cached');
      expect(provider.calls).toHaveLength(0);
    });
  });

  describe('Agent::Hooks::onResponse', () => {
    it('fires after each provider call with iteration, request, response, signal', async () => {
      const provider = new ScriptedProvider([{ content: 'raw', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      let seen: { iteration: number; content?: string } | undefined;
      agent.addHook('onResponse', (ctx) => {
        seen = { iteration: ctx.iteration, content: ctx.response.content };
      });

      await agent.chat('hi');
      expect(seen).toEqual({ iteration: 0, content: 'raw' });
    });

    it('replacing response affects what lands in history', async () => {
      const provider = new ScriptedProvider([{ content: 'raw', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      agent.addHook('onResponse', (ctx) => ({
        response: { ...ctx.response, content: 'rewritten' },
      }));

      await agent.chat('hi');

      const last = agent.history.getSnapshot().at(-1);
      expect(last).toMatchObject({ role: 'assistant', content: 'rewritten' });
    });
  });

  describe('Agent::Hooks::preToolCall', () => {
    it('fires per tool call with { call, tool, scope }', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      const tool = sumTool();
      registerTools(agent, tool);

      let seen: { name: string; toolMatch: boolean; scopeName: string } | undefined;
      agent.addHook('preToolCall', (ctx) => {
        seen = {
          name: ctx.call.name,
          toolMatch: ctx.tool === tool,
          scopeName: ctx.scope.name,
        };
      });

      await agent.chat('go');
      expect(seen).toEqual({ name: 'sum', toolMatch: true, scopeName: 'app' });
    });

    it('mutating call args affects what the tool handler receives', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const handler = vi.fn(({ a, b }: { a: number; b: number }) => a + b);
      const tool = new Tool({
        name: 'sum',
        description: 's',
        parameters: z.object({ a: z.number(), b: z.number() }),
        handler,
      });
      const agent = new Agent({ provider });
      registerTools(agent, tool);

      agent.addHook('preToolCall', (ctx) => ({
        call: { ...ctx.call, arguments: { a: 100, b: 200 } },
      }));

      await agent.chat('go');
      expect(handler).toHaveBeenCalledWith({ a: 100, b: 200 });
    });

    it('short-circuit with { result } skips the handler and feeds onToolCallResult', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const handler = vi.fn(() => 42);
      const tool = new Tool({
        name: 'sum',
        description: 's',
        parameters: z.object({ a: z.number(), b: z.number() }),
        handler,
      });
      const agent = new Agent({ provider });
      registerTools(agent, tool);

      agent.addHook('preToolCall', () => ({ result: 'CACHED' }));

      await agent.chat('go');

      expect(handler).not.toHaveBeenCalled();
      const toolMsg = agent.history.getSnapshot().find((m) => m.role === 'tool');
      expect((toolMsg as { content: string }).content).toBe(JSON.stringify('CACHED'));
    });

    it('short-circuit with { error } routes through onToolCallError', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const handler = vi.fn();
      const tool = new Tool({
        name: 'sum',
        description: 's',
        parameters: z.object({ a: z.number(), b: z.number() }),
        handler,
      });
      const agent = new Agent({ provider });
      registerTools(agent, tool);

      const denied = new Error('denied');
      agent.addHook('preToolCall', () => ({ error: denied }));
      const errFn = vi.fn();
      agent.addHook('onToolCallError', errFn);

      await agent.chat('go');

      expect(handler).not.toHaveBeenCalled();
      expect(errFn).toHaveBeenCalledTimes(1);
      expect(errFn.mock.calls[0]?.[0]).toMatchObject({ error: denied });
    });
  });

  describe('Agent::Hooks::onToolCallResult', () => {
    it('fires after a successful tool execution with the raw result', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      registerTools(agent, sumTool());

      const fn = vi.fn();
      agent.addHook('onToolCallResult', fn);

      await agent.chat('go');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0]?.[0]).toMatchObject({ result: 3 });
    });

    it('replacing result affects the tool message content in history', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      registerTools(agent, sumTool());

      agent.addHook('onToolCallResult', () => ({ result: 'REDACTED' }));

      await agent.chat('go');
      const toolMsg = agent.history.getSnapshot().find((m) => m.role === 'tool');
      expect((toolMsg as { content: string }).content).toBe(JSON.stringify('REDACTED'));
    });
  });

  describe('Agent::Hooks::onToolCallError', () => {
    it('fires when the handler throws', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'broken', arguments: {} }],
          finishReason: 'tool_calls',
        },
        { content: 'sorry', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      const handlerErr = new Error('handler boom');
      registerTools(agent, throwingTool(handlerErr));

      const fn = vi.fn();
      agent.addHook('onToolCallError', fn);

      await agent.chat('go');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0]?.[0]).toMatchObject({ error: handlerErr });
    });

    it('fires on Ag2bUnknownToolError with no tool/scope in ctx', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'ghost', arguments: {} }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      const fn = vi.fn();
      agent.addHook('onToolCallError', fn);

      await agent.chat('go');
      const ctx = fn.mock.calls[0]?.[0] as { tool?: unknown; scope?: unknown };
      expect(ctx.tool).toBeUndefined();
      expect(ctx.scope).toBeUndefined();
    });

    it('fires on Ag2bDisabledToolError with tool/scope present', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      agent.scopes.register(new Scope({ name: 'cart', enabled: () => false, tools: [sumTool()] }));

      const fn = vi.fn();
      agent.addHook('onToolCallError', fn);

      await agent.chat('add');
      const ctx = fn.mock.calls[0]?.[0] as { tool?: { name: string }; scope?: { name: string } };
      expect(ctx.tool?.name).toBe('sum');
      expect(ctx.scope?.name).toBe('cart');
    });

    it('replacing error affects the tool message content', async () => {
      const provider = new ScriptedProvider([
        {
          calls: [{ id: 'c1', name: 'broken', arguments: {} }],
          finishReason: 'tool_calls',
        },
        { content: 'done', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      registerTools(agent, throwingTool(new Error('orig')));

      agent.addHook('onToolCallError', () => ({ error: new Error('rewritten') }));

      await agent.chat('go');
      const toolMsg = agent.history.getSnapshot().find((m) => m.role === 'tool');
      const parsed = JSON.parse((toolMsg as { content: string }).content) as {
        error: { message: string };
      };
      expect(parsed.error.message).toBe('rewritten');
    });
  });

  describe('Agent::Hooks::onScopeRegister|onScopeUnregister', () => {
    it('fires onScopeRegister when a scope is added through agent.scopes', () => {
      const agent = new Agent({ provider: new ScriptedProvider([{ content: 'x' }]) });
      const fn = vi.fn();
      agent.addHook('onScopeRegister', fn);

      const scope = new Scope({ name: 'cart' });
      agent.scopes.register(scope);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({ scope });
    });

    it('fires onScopeUnregister when a scope is removed', () => {
      const agent = new Agent({ provider: new ScriptedProvider([{ content: 'x' }]) });
      const fn = vi.fn();
      agent.addHook('onScopeUnregister', fn);

      const scope = new Scope({ name: 'cart' });
      agent.scopes.register(scope);
      agent.scopes.unregister('cart');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith({ scope });
    });
  });

  describe('Agent::Hooks::cross-cutting', () => {
    it('hooks fire identically for chat and chatStream', async () => {
      const events: string[] = [];
      const makeAgent = () => {
        const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
        const a = new Agent({ provider });
        a.addHook('onChatStart', () => {
          events.push('start');
        });
        a.addHook('preRequest', () => {
          events.push('pre');
        });
        a.addHook('onResponse', () => {
          events.push('post');
        });
        a.addHook('onMessage', (ctx) => {
          events.push(`msg:${ctx.message.role}`);
        });
        a.addHook('onChatDone', () => {
          events.push('end');
        });
        return a;
      };

      await makeAgent().chat('hi');
      const syncOrder = [...events];
      events.length = 0;

      await collectStream(makeAgent(), 'hi');
      const streamOrder = [...events];

      expect(streamOrder).toEqual(syncOrder);
    });
  });
});
