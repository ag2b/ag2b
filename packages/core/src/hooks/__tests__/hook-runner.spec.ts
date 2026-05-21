/* eslint-disable @typescript-eslint/no-empty-function */
import z from 'zod/v4';

import type { AssistantToolCall } from '@/messages';
import type { ProviderRequest, ProviderResponse } from '@/provider';
import { Scope } from '@/scope';
import { Tool } from '@/tool';

import { HookRunner } from '../hook-runner';

const makeRequest = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  messages: [],
  tools: [],
  contexts: [],
  ...overrides,
});

const makeResponse = (overrides: Partial<ProviderResponse> = {}): ProviderResponse => ({
  content: 'ok',
  finishReason: 'stop',
  ...overrides,
});

const makeCall = (overrides: Partial<AssistantToolCall> = {}): AssistantToolCall => ({
  id: 'c1',
  name: 'sum',
  arguments: { a: 1, b: 2 },
  ...overrides,
});

const makeTool = () =>
  new Tool({
    name: 'sum',
    description: 'sum two numbers',
    parameters: z.object({ a: z.number(), b: z.number() }),
    handler: ({ a, b }) => a + b,
  });

const makeScope = (tools: Tool[] = []) => new Scope({ name: 'test-scope', tools });

describe('HookRunner', () => {
  describe('HookRunner::add', () => {
    it('registers a hook and returns a disposer', () => {
      const runner = new HookRunner();
      const calls: string[] = [];

      const dispose = runner.add('onChatStart', () => {
        calls.push('a');
      });

      void runner.run('onChatStart', { message: 'hi' });
      expect(typeof dispose).toBe('function');
    });

    it('preserves registration order (FIFO)', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      runner.add('onChatStart', () => {
        order.push('first');
      });
      runner.add('onChatStart', () => {
        order.push('second');
      });
      runner.add('onChatStart', () => {
        order.push('third');
      });

      await runner.run('onChatStart', { message: 'hi' });

      expect(order).toEqual(['first', 'second', 'third']);
    });

    it('disposer removes the hook', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      const offA = runner.add('onChatStart', () => {
        order.push('a');
      });
      runner.add('onChatStart', () => {
        order.push('b');
      });

      offA();

      await runner.run('onChatStart', { message: 'hi' });

      expect(order).toEqual(['b']);
    });

    it('disposer is idempotent', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      const off = runner.add('onChatStart', () => {
        order.push('a');
      });

      off();
      off();
      off();

      await runner.run('onChatStart', { message: 'hi' });
      expect(order).toEqual([]);
    });

    it('disposer for one hook does not affect others', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      runner.add('onChatStart', () => {
        order.push('a');
      });
      const offB = runner.add('onChatStart', () => {
        order.push('b');
      });
      runner.add('onChatStart', () => {
        order.push('c');
      });

      offB();

      await runner.run('onChatStart', { message: 'hi' });
      expect(order).toEqual(['a', 'c']);
    });

    it('events are isolated — registering for one does not affect another', async () => {
      const runner = new HookRunner();
      const calls: string[] = [];

      runner.add('onChatStart', () => {
        calls.push('start');
      });
      runner.add('onChatDone', () => {
        calls.push('end');
      });

      await runner.run('onChatStart', { message: 'hi' });
      expect(calls).toEqual(['start']);
    });
  });

  describe('HookRunner::run (observer dispatch)', () => {
    it('is a no-op when no hooks are registered', async () => {
      const runner = new HookRunner();
      await expect(runner.run('onChatStart', { message: 'hi' })).resolves.toBeUndefined();
    });

    it('passes the ctx to each hook', async () => {
      const runner = new HookRunner();
      const seen: string[] = [];

      runner.add('onChatStart', (ctx) => {
        seen.push(ctx.message);
      });
      runner.add('onChatStart', (ctx) => {
        seen.push(ctx.message);
      });

      await runner.run('onChatStart', { message: 'hello' });
      expect(seen).toEqual(['hello', 'hello']);
    });

    it('awaits async hooks sequentially', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      runner.add('onChatStart', async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push('slow');
      });
      runner.add('onChatStart', () => {
        order.push('fast');
      });

      await runner.run('onChatStart', { message: 'hi' });
      expect(order).toEqual(['slow', 'fast']);
    });

    it('propagates a hook throw', async () => {
      const runner = new HookRunner();

      runner.add('onChatStart', () => {
        throw new Error('boom');
      });

      await expect(runner.run('onChatStart', { message: 'hi' })).rejects.toThrow('boom');
    });

    it('skips subsequent hooks when one throws', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      runner.add('onChatStart', () => {
        order.push('a');
      });
      runner.add('onChatStart', () => {
        throw new Error('boom');
      });
      runner.add('onChatStart', () => {
        order.push('c');
      });

      await expect(runner.run('onChatStart', { message: 'hi' })).rejects.toThrow();
      expect(order).toEqual(['a']);
    });
  });

  describe('HookRunner::runChatError', () => {
    it('is a no-op when no hooks are registered', async () => {
      const runner = new HookRunner();
      await expect(runner.runChatError({ error: new Error('x') })).resolves.toBeUndefined();
    });

    it('fires hooks in registration order', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      runner.add('onChatError', () => {
        order.push('a');
      });
      runner.add('onChatError', () => {
        order.push('b');
      });

      await runner.runChatError({ error: new Error('x') });
      expect(order).toEqual(['a', 'b']);
    });

    it('passes the error in ctx', async () => {
      const runner = new HookRunner();
      const error = new Error('original');
      let seen: unknown;

      runner.add('onChatError', (ctx) => {
        seen = ctx.error;
      });

      await runner.runChatError({ error });
      expect(seen).toBe(error);
    });

    it('catches and ignores hook throws, continues to subsequent hooks', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      runner.add('onChatError', () => {
        throw new Error('hook 1 boom');
      });
      runner.add('onChatError', () => {
        order.push('b');
      });
      runner.add('onChatError', () => {
        throw new Error('hook 3 boom');
      });
      runner.add('onChatError', () => {
        order.push('d');
      });

      await expect(runner.runChatError({ error: new Error('x') })).resolves.toBeUndefined();
      expect(order).toEqual(['b', 'd']);
    });
  });

  describe('HookRunner::runPreRequest', () => {
    it('returns initial.request when no hooks are registered', async () => {
      const runner = new HookRunner();
      const request = makeRequest({ system: 'base' });

      const result = await runner.runPreRequest({ iteration: 0, request });

      expect(result).toEqual({ request });
    });

    it('returns initial.request when all hooks return void', async () => {
      const runner = new HookRunner();
      const request = makeRequest({ system: 'base' });

      runner.add('preRequest', () => {});
      runner.add('preRequest', () => {});

      const result = await runner.runPreRequest({ iteration: 0, request });
      expect(result).toEqual({ request });
    });

    it('applies a request modification and returns it', async () => {
      const runner = new HookRunner();
      const request = makeRequest({ system: 'base' });

      runner.add('preRequest', (ctx) => ({
        request: { ...ctx.request, system: 'modified' },
      }));

      const result = await runner.runPreRequest({ iteration: 0, request });
      expect(result).toEqual({ request: { ...request, system: 'modified' } });
    });

    it('propagates request modifications across hooks', async () => {
      const runner = new HookRunner();
      const request = makeRequest({ system: 'a' });

      runner.add('preRequest', (ctx) => ({
        request: { ...ctx.request, system: `${ctx.request.system}b` },
      }));
      runner.add('preRequest', (ctx) => ({
        request: { ...ctx.request, system: `${ctx.request.system}c` },
      }));

      const result = await runner.runPreRequest({ iteration: 0, request });
      expect('request' in result && result.request.system).toBe('abc');
    });

    it('short-circuits with response and skips remaining hooks', async () => {
      const runner = new HookRunner();
      const cachedResponse = makeResponse({ content: 'cached' });
      let secondCalled = false;

      runner.add('preRequest', () => ({ response: cachedResponse }));
      runner.add('preRequest', () => {
        secondCalled = true;
      });

      const result = await runner.runPreRequest({ iteration: 0, request: makeRequest() });

      expect(result).toEqual({ response: cachedResponse });
      expect(secondCalled).toBe(false);
    });

    it('does not mutate the initial request', async () => {
      const runner = new HookRunner();
      const request = makeRequest({ system: 'base' });
      const snapshot = structuredClone(request);

      runner.add('preRequest', (ctx) => ({
        request: { ...ctx.request, system: 'modified' },
      }));

      await runner.runPreRequest({ iteration: 0, request });
      expect(request).toEqual(snapshot);
    });

    it('treats a falsy response field as no short-circuit and continues', async () => {
      const runner = new HookRunner();
      const request = makeRequest({ system: 'base' });

      runner.add('preRequest', () => ({ response: undefined }) as never);
      runner.add('preRequest', (ctx) => ({
        request: { ...ctx.request, system: 'modified' },
      }));

      const result = await runner.runPreRequest({ iteration: 0, request });
      expect(result).toEqual({ request: { ...request, system: 'modified' } });
    });

    it('ignores a return with no recognized field', async () => {
      const runner = new HookRunner();
      const request = makeRequest({ system: 'base' });

      runner.add('preRequest', () => ({}) as never);

      const result = await runner.runPreRequest({ iteration: 0, request });
      expect(result).toEqual({ request });
    });

    it('forwards iteration and signal in ctx', async () => {
      const runner = new HookRunner();
      const signal = new AbortController().signal;
      let seenIteration: number | undefined;
      let seenSignal: AbortSignal | undefined;

      runner.add('preRequest', (ctx) => {
        seenIteration = ctx.iteration;
        seenSignal = ctx.signal;
      });

      await runner.runPreRequest({ iteration: 3, request: makeRequest(), signal });
      expect(seenIteration).toBe(3);
      expect(seenSignal).toBe(signal);
    });
  });

  describe('HookRunner::runPreToolCall', () => {
    const tool = makeTool();
    const scope = makeScope([tool]);

    it('returns initial.call when no hooks are registered', async () => {
      const runner = new HookRunner();
      const call = makeCall();

      const result = await runner.runPreToolCall({ call, tool, scope });
      expect(result).toEqual({ call });
    });

    it('returns initial.call when all hooks return void', async () => {
      const runner = new HookRunner();
      const call = makeCall();

      runner.add('preToolCall', () => {});
      runner.add('preToolCall', () => {});

      const result = await runner.runPreToolCall({ call, tool, scope });
      expect(result).toEqual({ call });
    });

    it('applies a call modification and propagates it', async () => {
      const runner = new HookRunner();
      const call = makeCall({ arguments: { a: 1 } });

      runner.add('preToolCall', (ctx) => ({
        call: { ...ctx.call, arguments: { ...ctx.call.arguments, a: 2 } },
      }));
      runner.add('preToolCall', (ctx) => ({
        call: { ...ctx.call, arguments: { ...ctx.call.arguments, b: 3 } },
      }));

      const result = await runner.runPreToolCall({ call, tool, scope });
      expect('call' in result && result.call.arguments).toEqual({ a: 2, b: 3 });
    });

    it('short-circuits with result and skips remaining hooks', async () => {
      const runner = new HookRunner();
      let secondCalled = false;

      runner.add('preToolCall', () => ({ result: 42 }));
      runner.add('preToolCall', () => {
        secondCalled = true;
      });

      const result = await runner.runPreToolCall({ call: makeCall(), tool, scope });
      expect(result).toEqual({ result: 42 });
      expect(secondCalled).toBe(false);
    });

    it('short-circuits with error and skips remaining hooks', async () => {
      const runner = new HookRunner();
      const denied = new Error('denied');
      let secondCalled = false;

      runner.add('preToolCall', () => ({ error: denied }));
      runner.add('preToolCall', () => {
        secondCalled = true;
      });

      const result = await runner.runPreToolCall({ call: makeCall(), tool, scope });
      expect(result).toEqual({ error: denied });
      expect(secondCalled).toBe(false);
    });

    it('ignores a return with no recognized field', async () => {
      const runner = new HookRunner();
      const call = makeCall();

      runner.add('preToolCall', () => {});

      const result = await runner.runPreToolCall({ call, tool, scope });
      expect(result).toEqual({ call });
    });

    it('ignores a non-falsy return that lacks error/result/call', async () => {
      const runner = new HookRunner();
      const call = makeCall();

      runner.add('preToolCall', () => ({}) as never);

      const result = await runner.runPreToolCall({ call, tool, scope });
      expect(result).toEqual({ call });
    });

    it('does not mutate the initial call', async () => {
      const runner = new HookRunner();
      const call = makeCall({ arguments: { a: 1 } });
      const snapshot = structuredClone(call);

      runner.add('preToolCall', (ctx) => ({
        call: { ...ctx.call, arguments: { a: 99 } },
      }));

      await runner.runPreToolCall({ call, tool, scope });
      expect(call).toEqual(snapshot);
    });

    it('first hook to short-circuit wins; later short-circuits are not seen', async () => {
      const runner = new HookRunner();
      let secondInvoked = false;

      runner.add('preToolCall', () => ({ result: 'first' }));
      runner.add('preToolCall', () => {
        secondInvoked = true;
        return { error: new Error('should not run') };
      });

      const result = await runner.runPreToolCall({ call: makeCall(), tool, scope });
      expect(result).toEqual({ result: 'first' });
      expect(secondInvoked).toBe(false);
    });
  });

  describe('HookRunner::runOnResponse', () => {
    it('returns initial.response when no hooks are registered', async () => {
      const runner = new HookRunner();
      const response = makeResponse();
      const request = makeRequest();

      const result = await runner.runOnResponse({ iteration: 0, request, response });
      expect(result).toEqual({ response });
    });

    it('returns initial.response when all hooks return void', async () => {
      const runner = new HookRunner();
      const response = makeResponse();

      runner.add('onResponse', () => {});

      const result = await runner.runOnResponse({
        iteration: 0,
        request: makeRequest(),
        response,
      });
      expect(result).toEqual({ response });
    });

    it('applies a response modification', async () => {
      const runner = new HookRunner();
      const response = makeResponse({ content: 'original' });

      runner.add('onResponse', (ctx) => ({
        response: { ...ctx.response, content: 'modified' },
      }));

      const result = await runner.runOnResponse({
        iteration: 0,
        request: makeRequest(),
        response,
      });
      expect(result.response.content).toBe('modified');
    });

    it('runs ALL hooks even after a modification (no short-circuit)', async () => {
      const runner = new HookRunner();
      const order: string[] = [];

      runner.add('onResponse', (ctx) => {
        order.push('a');
        return { response: { ...ctx.response, content: 'a' } };
      });
      runner.add('onResponse', (ctx) => {
        order.push('b');
        return { response: { ...ctx.response, content: ctx.response.content + 'b' } };
      });
      runner.add('onResponse', () => {
        order.push('c');
      });

      const result = await runner.runOnResponse({
        iteration: 0,
        request: makeRequest(),
        response: makeResponse({ content: '' }),
      });
      expect(order).toEqual(['a', 'b', 'c']);
      expect(result.response.content).toBe('ab');
    });
  });

  describe('HookRunner::runOnToolCallResult', () => {
    const tool = makeTool();
    const scope = makeScope([tool]);

    it('returns initial.result when no hooks are registered', async () => {
      const runner = new HookRunner();
      const out = await runner.runOnToolCallResult({ call: makeCall(), tool, scope, result: 42 });
      expect(out).toEqual({ result: 42 });
    });

    it('returns initial.result when all hooks return void', async () => {
      const runner = new HookRunner();
      runner.add('onToolCallResult', () => {});

      const out = await runner.runOnToolCallResult({ call: makeCall(), tool, scope, result: 42 });
      expect(out).toEqual({ result: 42 });
    });

    it('applies a result replacement', async () => {
      const runner = new HookRunner();
      runner.add('onToolCallResult', () => ({ result: 'replaced' }));

      const out = await runner.runOnToolCallResult({ call: makeCall(), tool, scope, result: 42 });
      expect(out).toEqual({ result: 'replaced' });
    });

    it('runs all hooks; later hooks see prior result', async () => {
      const runner = new HookRunner();

      runner.add('onToolCallResult', (ctx) => ({ result: (ctx.result as number) + 1 }));
      runner.add('onToolCallResult', (ctx) => ({ result: (ctx.result as number) * 2 }));

      const out = await runner.runOnToolCallResult({ call: makeCall(), tool, scope, result: 5 });
      expect(out).toEqual({ result: 12 }); // (5 + 1) * 2
    });
  });

  describe('HookRunner::runOnToolCallError', () => {
    const tool = makeTool();
    const scope = makeScope([tool]);

    it('returns initial.error when no hooks are registered', async () => {
      const runner = new HookRunner();
      const error = new Error('boom');
      const out = await runner.runOnToolCallError({ call: makeCall(), tool, scope, error });
      expect(out).toEqual({ error });
    });

    it('returns initial.error when all hooks return void', async () => {
      const runner = new HookRunner();
      const error = new Error('boom');
      runner.add('onToolCallError', () => {});

      const out = await runner.runOnToolCallError({ call: makeCall(), tool, scope, error });
      expect(out).toEqual({ error });
    });

    it('applies an error replacement', async () => {
      const runner = new HookRunner();
      const replacement = new Error('wrapped');

      runner.add('onToolCallError', () => ({ error: replacement }));

      const out = await runner.runOnToolCallError({
        call: makeCall(),
        tool,
        scope,
        error: new Error('original'),
      });
      expect(out).toEqual({ error: replacement });
    });

    it('runs all hooks; later hooks see prior error', async () => {
      const runner = new HookRunner();

      runner.add('onToolCallError', () => ({ error: new Error('first wrap') }));
      runner.add('onToolCallError', (ctx) => ({
        error: new Error(`second wrap of: ${(ctx.error as Error).message}`),
      }));

      const out = await runner.runOnToolCallError({
        call: makeCall(),
        tool,
        scope,
        error: new Error('orig'),
      });
      expect((out.error as Error).message).toBe('second wrap of: first wrap');
    });
  });
});
