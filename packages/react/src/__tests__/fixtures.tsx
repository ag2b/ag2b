import type { Agent, ProviderRequest, ProviderResponse, ProviderStreamChunk } from '@ag2b/core';
import { AbstractProvider, createAgent, StreamableProvider } from '@ag2b/core';
import type { FC, PropsWithChildren } from 'react';

import { Ag2bProvider } from '@/provider';

type ChatCall = {
  request: ProviderRequest;
  signal?: AbortSignal;
};

/** Sync provider that yields scripted responses in order. Throws if exhausted. */
export class ScriptedProvider extends AbstractProvider {
  public calls: ChatCall[] = [];
  readonly #scripted: ProviderResponse[];

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

/** Streaming provider that yields scripted chunk arrays in order. Throws if exhausted. */
export class ScriptedStreamingProvider extends StreamableProvider {
  public calls: ChatCall[] = [];
  readonly #scripted: ProviderStreamChunk[][];

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

/** Build an Agent backed by a ScriptedProvider. */
export const makeAgent = (responses: ProviderResponse[] = []): Agent =>
  createAgent({ provider: new ScriptedProvider(responses) });

/** Build an Agent backed by a ScriptedStreamingProvider. */
export const makeStreamingAgent = (chunks: ProviderStreamChunk[][] = []): Agent =>
  createAgent({ provider: new ScriptedStreamingProvider(chunks) });

/** Build a renderHook wrapper that mounts the given agent into Ag2bProvider. */
export const wrapper = (agent: Agent): FC<PropsWithChildren> => {
  const Wrapper: FC<PropsWithChildren> = ({ children }) => (
    <Ag2bProvider agent={agent}>{children}</Ag2bProvider>
  );
  return Wrapper;
};
