import type { Agent, ProviderRequest, ProviderResponse, ProviderStreamChunk } from '@ag2b/core';
import { AbstractProvider, createAgent, StreamableProvider } from '@ag2b/core';
import { Ag2bProvider } from '@ag2b/react';
import type { FC, PropsWithChildren } from 'react';

type ChatCall = { request: ProviderRequest; signal?: AbortSignal };

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
    if (!next) throw new Error('ScriptedProvider exhausted');
    return Promise.resolve(next);
  }
}

export class ScriptedStreamingProvider extends StreamableProvider {
  public calls: ChatCall[] = [];
  readonly #scripted: ProviderStreamChunk[][];

  constructor(scripted: ProviderStreamChunk[][]) {
    super({ baseURL: '/x' });
    this.#scripted = [...scripted];
  }

  protected runChat(): Promise<ProviderResponse> {
    throw new Error('not used');
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
    if (!next) throw new Error('ScriptedStreamingProvider exhausted');
    for (const chunk of next) yield chunk;
  }
}

export const makeAgent = (responses: ProviderResponse[] = []): Agent =>
  createAgent({ provider: new ScriptedProvider(responses) });

export const makeStreamingAgent = (chunks: ProviderStreamChunk[][] = []): Agent =>
  createAgent({ provider: new ScriptedStreamingProvider(chunks) });

export const wrapper = (agent: Agent): FC<PropsWithChildren> => {
  const Wrapper: FC<PropsWithChildren> = ({ children }) => (
    <Ag2bProvider agent={agent}>{children}</Ag2bProvider>
  );
  return Wrapper;
};
