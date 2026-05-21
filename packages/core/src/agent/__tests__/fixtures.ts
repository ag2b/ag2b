import z from 'zod/v4';

import type { ProviderRequest, ProviderResponse, ProviderStreamChunk } from '@/provider';
import { AbstractProvider, StreamableProvider } from '@/provider';
import { Scope } from '@/scope';
import { Tool } from '@/tool';

import type { Agent } from '../agent';
import type { AgentEvent } from '../event';

export type ChatCall = {
  request: ProviderRequest;
  signal?: AbortSignal;
};

export class ScriptedProvider extends AbstractProvider {
  public calls: ChatCall[] = [];
  #scripted: ProviderResponse[];

  constructor(scripted: ProviderResponse[]) {
    super({ baseURL: '/x' });
    this.#scripted = [...scripted];
  }

  protected runChat(): Promise<ProviderResponse> {
    throw new Error('not used — chat is overridden');
  }

  override chat(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse> {
    this.calls.push({ request: { ...request, messages: [...request.messages] }, signal });
    const next = this.#scripted.shift();
    if (!next) throw new Error('ScriptedProvider exhausted — test scripted too few responses');
    return Promise.resolve(next);
  }
}

export class ScriptedStreamingProvider extends StreamableProvider {
  public calls: ChatCall[] = [];
  #scripted: ProviderStreamChunk[][];

  constructor(scripted: ProviderStreamChunk[][]) {
    super({ baseURL: '/x' });
    this.#scripted = [...scripted];
  }

  protected runChat(): Promise<ProviderResponse> {
    throw new Error('not used in streaming tests');
  }

  protected runChatStream(): AsyncGenerator<ProviderStreamChunk> {
    throw new Error('not used — chatStream is overridden');
  }

  override chat(): Promise<ProviderResponse> {
    throw new Error('ScriptedStreamingProvider.chat should not be called');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async *chatStream(
    request: ProviderRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ProviderStreamChunk> {
    this.calls.push({ request: { ...request, messages: [...request.messages] }, signal });
    const next = this.#scripted.shift();
    if (!next)
      throw new Error('ScriptedStreamingProvider exhausted — test scripted too few responses');
    for (const chunk of next) yield chunk;
  }
}

export const sumTool = (): Tool =>
  new Tool({
    name: 'sum',
    description: 'Sum two numbers',
    parameters: z.object({ a: z.number(), b: z.number() }),
    handler: ({ a, b }) => a + b,
  });

export const throwingTool = (err: unknown): Tool =>
  new Tool({
    name: 'broken',
    description: 'Always throws',
    parameters: z.object({}),
    handler: () => {
      throw err;
    },
  });

export async function collectStream(
  agent: Agent,
  message: string,
  signal?: AbortSignal
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.chatStream(message, signal)) {
    events.push(event);
  }
  return events;
}

export const registerTools = (agent: Agent, ...tools: Tool[]): void => {
  agent.scopes.register(new Scope({ name: 'app', tools }));
};
