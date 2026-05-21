import type { AssistantToolCall } from '@/messages';
import type { ProviderRequest, ProviderResponse } from '@/provider';
import type { Awaitable } from '@/types';

import type {
  AgentHooks,
  OnChatAbortCtx,
  OnChatErrorCtx,
  OnResponseCtx,
  OnToolCallErrorCtx,
  OnToolCallResultCtx,
  PreRequestCtx,
  PreToolCallCtx,
} from './hooks';

export type AnyHook = (ctx: never) => Awaitable<unknown>;

export type ObserverEvent = Exclude<
  {
    [K in keyof AgentHooks]: AgentHooks[K] extends (ctx: never) => Awaitable<void> ? K : never;
  }[keyof AgentHooks],
  // Excluded since onChatError and onChatAbort have their own catch-and-ignore paths
  'onChatError' | 'onChatAbort'
>;

export class HookRunner {
  readonly #hooks = new Map<keyof AgentHooks, AnyHook[]>();

  add<K extends keyof AgentHooks>(event: K, hook: AgentHooks[K]): () => void {
    let hooks = this.#hooks.get(event);

    if (!hooks) {
      hooks = [];
      this.#hooks.set(event, hooks);
    }

    hooks.push(hook as AnyHook);

    return () => {
      const i = hooks.indexOf(hook as AnyHook);
      if (i >= 0) hooks.splice(i, 1);
    };
  }

  async run<K extends ObserverEvent>(event: K, ctx: Parameters<AgentHooks[K]>[0]): Promise<void> {
    for (const hook of this.hooksFor(event)) {
      await (hook as (c: typeof ctx) => Awaitable<void>)(ctx);
    }
  }

  async runChatAbort(ctx: OnChatAbortCtx): Promise<void> {
    for (const hook of this.hooksFor('onChatAbort')) {
      try {
        await hook(ctx);
      } catch {
        /* original abort still propagates */
      }
    }
  }

  async runChatError(ctx: OnChatErrorCtx): Promise<void> {
    for (const hook of this.hooksFor('onChatError')) {
      try {
        await hook(ctx);
      } catch {
        /* original error still propagates */
      }
    }
  }

  async runPreRequest(
    initial: PreRequestCtx
  ): Promise<{ request: ProviderRequest } | { response: ProviderResponse }> {
    const ctx = { ...initial };
    for (const hook of this.hooksFor('preRequest')) {
      const result = await hook(ctx);
      if (!result) continue;
      if ('response' in result && result.response) return { response: result.response };
      if ('request' in result) ctx.request = result.request;
    }
    return { request: ctx.request };
  }

  async runPreToolCall(
    initial: PreToolCallCtx
  ): Promise<{ call: AssistantToolCall } | { result: unknown } | { error: unknown }> {
    const ctx = { ...initial };
    for (const hook of this.hooksFor('preToolCall')) {
      const result = await hook(ctx);
      if (!result) continue;
      if ('error' in result) return { error: result.error };
      if ('result' in result) return { result: result.result };
      if ('call' in result) ctx.call = result.call;
    }
    return { call: ctx.call };
  }

  async runOnResponse(initial: OnResponseCtx): Promise<{ response: ProviderResponse }> {
    const ctx = { ...initial };
    for (const hook of this.hooksFor('onResponse')) {
      const result = await hook(ctx);
      if (result && 'response' in result) ctx.response = result.response;
    }
    return { response: ctx.response };
  }

  async runOnToolCallResult(initial: OnToolCallResultCtx): Promise<{ result: unknown }> {
    const ctx = { ...initial };
    for (const hook of this.hooksFor('onToolCallResult')) {
      const result = await hook(ctx);
      if (result && 'result' in result) ctx.result = result.result;
    }
    return { result: ctx.result };
  }

  async runOnToolCallError(initial: OnToolCallErrorCtx): Promise<{ error: unknown }> {
    const ctx = { ...initial };
    for (const hook of this.hooksFor('onToolCallError')) {
      const result = await hook(ctx);
      if (result && 'error' in result) ctx.error = result.error;
    }
    return { error: ctx.error };
  }

  private hooksFor<K extends keyof AgentHooks>(event: K): AgentHooks[K][] {
    return (this.#hooks.get(event) ?? []) as AgentHooks[K][];
  }
}
