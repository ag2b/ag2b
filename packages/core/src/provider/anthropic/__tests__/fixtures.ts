import z from 'zod/v4';

import { Tool } from '@/tool';

import type { ProviderRequest } from '../../abstract.provider';
import type {
  AnthropicTextBlock,
  AnthropicToolResultBlock,
  AnthropicToolUseBlock,
} from '../anthropic.types';

export type RequestContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export type RequestMessage = {
  role: string;
  content: string | RequestContentBlock[];
};

export type RequestBody = {
  model?: string;
  max_tokens?: number;
  system?: string;
  messages: RequestMessage[];
  tools?: { name: string; description: string; input_schema: unknown }[];
  stream: boolean;
};

export function createAnthropicResponse(
  content: (AnthropicTextBlock | AnthropicToolUseBlock)[],
  stop_reason: string | null
) {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
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

export function createSSEStream(...events: string[]) {
  const text = events.map((e) => `data: ${e}\n\n`).join('');
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

export function createStreamFetch(...events: string[]) {
  const stream = createSSEStream(...events);
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
