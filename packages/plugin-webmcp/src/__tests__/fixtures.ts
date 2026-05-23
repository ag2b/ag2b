import type { ProviderResponse } from '@ag2b/core';
import { AbstractProvider, Agent, Scope, Tool } from '@ag2b/core';
import z from 'zod/v4';

export class StubProvider extends AbstractProvider {
  constructor() {
    super({ baseURL: '/x' });
  }

  protected runChat(): Promise<ProviderResponse> {
    throw new Error('not used in plugin-webmcp tests');
  }
}

export function makeAgent(): Agent {
  return new Agent({ provider: new StubProvider() });
}

export function sumTool(name = 'sum'): Tool {
  return new Tool({
    name,
    description: 'Sum two numbers',
    parameters: z.object({ a: z.number(), b: z.number() }),
    handler: ({ a, b }) => a + b,
  });
}

export function makeScope(name: string, tools: Tool[]): Scope {
  return new Scope({ name, tools });
}

export type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: object;
  execute: (input: unknown) => Promise<unknown>;
  signal?: AbortSignal;
};

export function installFakeModelContext(): {
  registered: RegisteredTool[];
  uninstall: () => void;
} {
  const registered: RegisteredTool[] = [];

  const fake = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addEventListener: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    removeEventListener: () => {},
    dispatchEvent: () => true,
    registerTool: (tool: Omit<RegisteredTool, 'signal'>, options?: { signal?: AbortSignal }) => {
      registered.push({ ...tool, signal: options?.signal });
    },
  };

  Object.defineProperty(navigator, 'modelContext', {
    value: fake,
    configurable: true,
  });

  const uninstall = (): void => {
    if ('modelContext' in navigator) {
      delete (navigator as { modelContext?: unknown }).modelContext;
    }
  };

  return { registered, uninstall };
}
