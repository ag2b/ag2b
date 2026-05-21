import {
  Ag2bDisabledToolError,
  Ag2bMaxIterationsError,
  Ag2bUnknownToolError,
  serializeError,
} from '@/errors';
import { History } from '@/history';
import type { AgentHooks } from '@/hooks';
import { HookRunner } from '@/hooks';
import type { AssistantToolCall, ChatMessage, FinishReason } from '@/messages';
import { assistantMessage, toolMessage, userMessage } from '@/messages';
import type { AbstractProvider, ProviderRequest, ProviderResponse } from '@/provider';
import type { Scope } from '@/scope';
import { ScopeRegistry } from '@/scope';
import type { Tool } from '@/tool';

import type { ProviderCaller } from './callers';
import { createStreamCaller, createSyncCaller } from './callers';
import type { AgentEvent } from './event';
import type { Ag2bPlugin, Ag2bPluginCleanup } from './plugin';
import { AsyncQueue, CallbackSink, type EventSink } from './sinks';

/** Configuration for creating an {@link Agent}. */
export type AgentConfig = {
  /** LLM provider to use for chat completions. */
  provider: AbstractProvider;
  /** System prompt sent with every LLM request. */
  system?: string;
  /** Maximum tool-calling iterations before throwing. @default 20 */
  maxIterations?: number;
};

/** Options passed to {@link Agent.chat}. */
export type ChatOptions = {
  /** Optional abort signal forwarded into the agent loop. */
  signal?: AbortSignal;
  /**
   * Optional callback invoked for each event emitted by the agent loop.
   */
  onEvent?: (event: AgentEvent) => void;
};

/**
 * The result of an {@link Agent.chat} or {@link Agent.chatStream} call.
 */
export type AgentResponse = {
  /** Final text content from the assistant. */
  content?: string;
  /** Reasoning text from the final iteration of the agent loop, if the provider produced any. */
  reasoning?: string;
  /** Reason the LLM stopped generating. */
  finishReason?: FinishReason;
};

/** Factory function to create an {@link Agent} instance. */
export function createAgent(config: AgentConfig, scopes: Scope[] = []): Agent {
  const agent = new Agent(config);

  for (const scope of scopes) {
    agent.scopes.register(scope);
  }

  return agent;
}

export class Agent {
  readonly #provider: AbstractProvider;
  readonly #system?: string;
  readonly #history = new History();
  readonly #hooks = new HookRunner();
  readonly #scopes: ScopeRegistry;
  readonly #maxIterations: number;

  constructor({ provider, system, maxIterations = 20 }: AgentConfig) {
    this.#provider = provider;
    this.#system = system;
    this.#maxIterations = maxIterations;
    this.#scopes = new ScopeRegistry({
      onRegister: (scope) => void this.#hooks.run('onScopeRegister', { scope }),
      onUnregister: (scope) => void this.#hooks.run('onScopeUnregister', { scope }),
    });
  }

  /** The conversation history. */
  get history(): History {
    return this.#history;
  }

  /** The scopes registry. */
  get scopes(): ScopeRegistry {
    return this.#scopes;
  }

  /**
   * Register a hook for a lifecycle event. Hooks fire in registration order;
   * `pre*` hooks may modify the operation or short-circuit it via a typed
   * return value, `on*` hooks observe (and some may modify post-event state).
   *
   * See {@link AgentHooks} for the full event list and per-event timing /
   * return semantics.
   *
   * @param event - Name of the lifecycle event.
   * @param hook - Function to call when the event fires.
   * @returns A disposer that removes this hook when called. Idempotent.
   *
   * @example
   * ```ts
   * const off = agent.addHook('onMessage', (ctx) => {
   *   if (ctx.message.role === 'assistant') console.log(ctx.message.content);
   * });
   * // later
   * off();
   * ```
   */
  addHook<K extends keyof AgentHooks>(event: K, hook: AgentHooks[K]): () => void {
    return this.#hooks.add(event, hook);
  }

  /**
   * Install a plugin. The plugin is a function that receives this agent and
   * typically calls {@link addHook} one or more times. May be sync or async —
   * async plugins are awaited so setup errors surface to the caller before
   * any chat starts.
   *
   * @param plugin - The plugin function to install.
   * @returns The plugin's optional cleanup function (e.g. on a React unmount).
   *   `undefined` when the plugin returned no cleanup.
   *
   * @example
   * ```ts
   * const cleanup = await agent.use(myPlugin);
   * // later
   * cleanup?.();
   * ```
   */
  async use(plugin: Ag2bPlugin): Promise<Ag2bPluginCleanup | undefined> {
    const cleanup = await plugin(this);
    return typeof cleanup === 'function' ? cleanup : undefined;
  }

  /**
   * Send a user message and run the agent loop until a final response is produced.
   * @param message - The user's message text.
   * @param options - Optional {@link ChatOptions}: abort signal and/or event callback.
   */
  async chat(message: string, options?: ChatOptions): Promise<AgentResponse> {
    const sink: EventSink | undefined = options?.onEvent
      ? new CallbackSink(options.onEvent)
      : undefined;

    return this.runChat(message, createSyncCaller(this.#provider, sink), sink, options?.signal);
  }

  /**
   * Send a user message and stream events as they happen (text deltas, tool calls, done).
   * @param message - The user's message text.
   * @param signal - Optional AbortSignal for cancellation.
   */
  async *chatStream(message: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
    const queue = new AsyncQueue();
    let promise: Promise<unknown> | undefined;

    try {
      const caller = createStreamCaller(this.#provider, queue);

      promise = this.runChat(message, caller, queue, signal).catch((err: Error) =>
        queue.error(err)
      );

      yield* queue;
    } finally {
      if (promise) await promise;
    }
  }

  private async runChat(
    message: string,
    caller: ProviderCaller,
    sink?: EventSink,
    signal?: AbortSignal
  ): Promise<AgentResponse> {
    await this.#hooks.run('onChatStart', { message, signal });
    sink?.push({ type: 'agent_chat_start', message });

    try {
      await this.pushMessage(userMessage(message));
      const response = await this.loop(caller, sink, signal);
      await this.#hooks.run('onChatDone', { response });
      sink?.push({ type: 'agent_chat_done', response }).end?.();

      return response;
    } catch (error) {
      if (signal?.aborted) {
        const reason = signal.reason as unknown;
        await this.#hooks.runChatAbort({ reason });
        sink?.push({ type: 'agent_chat_abort', reason });
      } else {
        await this.#hooks.runChatError({ error });
        sink?.push({ type: 'agent_chat_error', error });
      }
      throw error;
    }
  }

  private async loop(
    caller: ProviderCaller,
    sink?: EventSink,
    signal?: AbortSignal
  ): Promise<AgentResponse> {
    let iteration = 0;
    while (true) {
      signal?.throwIfAborted();

      const { calls, content, reasoning, finishReason } = await this.runIteration(
        iteration,
        caller,
        sink,
        signal
      );

      if (!calls?.length) {
        return { content, reasoning, finishReason };
      }

      for (const call of calls) {
        await this.executeTool(call, sink);
      }

      if (++iteration >= this.#maxIterations) {
        throw new Ag2bMaxIterationsError(iteration);
      }
    }
  }

  private async runIteration(
    iteration: number,
    caller: ProviderCaller,
    sink?: EventSink,
    signal?: AbortSignal
  ): Promise<ProviderResponse> {
    let request: ProviderRequest = {
      messages: this.#history.getSnapshot(),
      contexts: this.#scopes.getContexts(),
      tools: this.#scopes.getEnabledTools(),
      system: this.#system,
    };

    const pre = await this.#hooks.runPreRequest({
      iteration,
      request,
      signal,
    });

    request = 'request' in pre ? pre.request : request;
    const response = 'response' in pre ? pre.response : await caller(request, signal);

    const post = await this.#hooks.runOnResponse({
      iteration,
      request,
      response,
      signal,
    });

    await this.pushMessage(assistantMessage(post.response));
    sink?.push({ type: 'agent_content_end' });

    return post.response;
  }

  private async executeTool(call: AssistantToolCall, sink?: EventSink): Promise<void> {
    sink?.push({ type: 'agent_tool_call_start', call });

    const found = this.#scopes.findTool(call.name);
    if (!found) {
      return this.rejectTool({ call, error: new Ag2bUnknownToolError(call.name), sink });
    }

    const { tool, scope } = found;
    const pre = await this.#hooks.runPreToolCall({ call, tool, scope });

    if ('error' in pre) return this.rejectTool({ call, tool, scope, error: pre.error, sink });
    if ('result' in pre) return this.resolveTool({ call, tool, scope, result: pre.result, sink });
    if (!found.enabled)
      return this.rejectTool({
        call,
        tool,
        scope,
        error: new Ag2bDisabledToolError(call.name),
        sink,
      });

    try {
      const result = await tool.execute(pre.call.arguments);
      return this.resolveTool({ call, tool, scope, result, sink });
    } catch (error) {
      return this.rejectTool({ call, tool, scope, error, sink });
    }
  }

  private async resolveTool({
    call,
    tool,
    scope,
    result,
    sink,
  }: {
    call: AssistantToolCall;
    tool: Tool;
    scope: Scope;
    result: unknown;
    sink?: EventSink;
  }): Promise<void> {
    const post = await this.#hooks.runOnToolCallResult({ call, tool, scope, result });
    await this.pushMessage(toolMessage(call.id, JSON.stringify(post.result ?? null)));
    sink?.push({ type: 'agent_tool_call_result', call, result: post.result });
  }

  private async rejectTool({
    call,
    tool,
    scope,
    error,
    sink,
  }: {
    call: AssistantToolCall;
    tool?: Tool;
    scope?: Scope;
    error: unknown;
    sink?: EventSink;
  }): Promise<void> {
    const post = await this.#hooks.runOnToolCallError({ call, tool, scope, error });
    await this.pushMessage(
      toolMessage(call.id, JSON.stringify({ error: serializeError(post.error) }))
    );
    sink?.push({ type: 'agent_tool_call_error', call, error: post.error });
  }

  private async pushMessage(message: ChatMessage) {
    this.#history.push(message);
    await this.#hooks.run('onMessage', { message });
  }
}
