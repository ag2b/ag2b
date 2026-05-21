import z from 'zod/v4';

import { Tool } from '@/tool';

import type { ProviderRequest } from '../../abstract.provider';

export type RequestMessage = {
  role: string;
  content?: string | null;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

export type RequestBody = {
  model?: string;
  messages: RequestMessage[];
  tools?: { type: string; function: { name: string; description: string; parameters: unknown } }[];
  stream: boolean;
};

export function createOpenAiResponse(
  content: string | null,
  finish_reason: string,
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
) {
  return {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
          ...(tool_calls ? { tool_calls } : {}),
        },
        finish_reason,
      },
    ],
  };
}

export function createMockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

export function createSSEStream(...lines: string[]) {
  const text = lines.map((l) => `data: ${l}\n\n`).join('') + 'data: [DONE]\n\n';
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(text)];
  let index = 0;

  return {
    body: {
      getReader: () => ({
        read: () => {
          if (index < chunks.length) {
            return Promise.resolve({ done: false, value: chunks[index++] });
          }
          return Promise.resolve({ done: true, value: undefined });
        },
        releaseLock: vi.fn(),
      }),
    },
  };
}

export function createStreamFetch(...lines: string[]) {
  const stream = createSSEStream(...lines);
  return vi.fn().mockResolvedValue({ ok: true, status: 200, ...stream });
}

export const tools = [
  new Tool({
    name: 'sum',
    description: 'Sum two numbers',
    parameters: z.object({ a: z.number(), b: z.number() }),
    handler: ({ a, b }) => a + b,
  }),
];

export const req = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
  messages: [],
  tools: [],
  contexts: [],
  ...overrides,
});
