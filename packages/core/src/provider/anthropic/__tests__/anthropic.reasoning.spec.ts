import type { ChatMessage } from '@/messages';

import type { ProviderStreamChunk } from '../../streamable.provider';
import { AnthropicProvider } from '../anthropic.provider';
import { req } from './fixtures';

describe('AnthropicProvider::Reasoning', () => {
  describe('AnthropicProvider::Reasoning::Config', () => {
    it('adds `thinking` field to request body when enabled', async () => {
      let capturedBody: unknown;
      const fetchFn = vi.fn<typeof fetch>((_url, init) => {
        capturedBody = JSON.parse(init!.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'x',
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'ok' }],
              stop_reason: 'end_turn',
            }),
          text: () => Promise.resolve(''),
        } as Response);
      });

      const provider = new AnthropicProvider({
        baseURL: 'http://mock',
        fetch: fetchFn,
        model: 'claude-opus',
        maxTokens: 1024,
        thinking: { enabled: true, budgetTokens: 10000 },
      });
      await provider.chat(req());

      expect(capturedBody).toMatchObject({
        thinking: { type: 'enabled', budget_tokens: 10000 },
      });
    });

    it('omits `thinking` field when not configured', async () => {
      let capturedBody: unknown;
      const fetchFn = vi.fn<typeof fetch>((_url, init) => {
        capturedBody = JSON.parse(init!.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'x',
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'ok' }],
              stop_reason: 'end_turn',
            }),
          text: () => Promise.resolve(''),
        } as Response);
      });

      const provider = new AnthropicProvider({ baseURL: 'http://mock', fetch: fetchFn });
      await provider.chat(req());

      expect(capturedBody).not.toHaveProperty('thinking');
    });

    it('omits `thinking` field when enabled is false', async () => {
      let capturedBody: unknown;
      const fetchFn = vi.fn<typeof fetch>((_url, init) => {
        capturedBody = JSON.parse(init!.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'x',
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'ok' }],
              stop_reason: 'end_turn',
            }),
          text: () => Promise.resolve(''),
        } as Response);
      });

      const provider = new AnthropicProvider({
        baseURL: 'http://mock',
        fetch: fetchFn,
        thinking: { enabled: false, budgetTokens: 10000 },
      });
      await provider.chat(req());

      expect(capturedBody).not.toHaveProperty('thinking');
    });
  });

  describe('AnthropicProvider::Reasoning::SyncParsing', () => {
    it('parses thinking block into reasoning + metadata.reasoningSignature', async () => {
      const fetchFn = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'x',
              type: 'message',
              role: 'assistant',
              content: [
                { type: 'thinking', thinking: 'Step-by-step…', signature: 'sig-abc' },
                { type: 'text', text: 'Done' },
              ],
              stop_reason: 'end_turn',
            }),
          text: () => Promise.resolve(''),
        } as Response)
      );

      const provider = new AnthropicProvider({ baseURL: 'http://mock', fetch: fetchFn });
      const response = await provider.chat(req());

      expect(response.reasoning).toBe('Step-by-step…');
      expect(response.metadata?.reasoningSignature).toBe('sig-abc');
      expect(response.content).toBe('Done');
    });

    it('handles sync response without thinking block', async () => {
      const fetchFn = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'x',
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'Hi' }],
              stop_reason: 'end_turn',
            }),
          text: () => Promise.resolve(''),
        } as Response)
      );

      const provider = new AnthropicProvider({ baseURL: 'http://mock', fetch: fetchFn });
      const response = await provider.chat(req());
      expect(response.reasoning).toBeUndefined();
      expect(response.metadata).toBeUndefined();
    });
  });

  describe('AnthropicProvider::Reasoning::StreamParsing', () => {
    it('yields provider_reasoning_delta for thinking_delta events', async () => {
      const sse = [
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me "}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"think."}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig-xyz"}}',
        'data: {"type":"content_block_stop","index":0}',
        'data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}',
        'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Done."}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
      ].join('\n');

      const fetchFn = vi.fn(() =>
        Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sse));
              controller.close();
            },
          }),
        } as Response)
      );
      const provider = new AnthropicProvider({ baseURL: 'http://mock', fetch: fetchFn });

      const chunks: ProviderStreamChunk[] = [];
      for await (const chunk of provider.chatStream(req())) chunks.push(chunk);

      const reasoningDeltas = chunks.filter(
        (c: ProviderStreamChunk) => c.type === 'provider_reasoning_delta'
      );
      expect(reasoningDeltas).toEqual([
        { type: 'provider_reasoning_delta', delta: 'Let me ' },
        { type: 'provider_reasoning_delta', delta: 'think.' },
      ]);
    });

    it('attaches buffered signature to provider_stream_done', async () => {
      const sse = [
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"x"}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig-xyz"}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
      ].join('\n');

      const fetchFn = vi.fn(() =>
        Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sse));
              controller.close();
            },
          }),
        } as Response)
      );
      const provider = new AnthropicProvider({ baseURL: 'http://mock', fetch: fetchFn });

      const chunks: ProviderStreamChunk[] = [];
      for await (const chunk of provider.chatStream(req())) chunks.push(chunk);

      const done = chunks.find((c: ProviderStreamChunk) => c.type === 'provider_stream_done');
      expect(done).toEqual({
        type: 'provider_stream_done',
        finishReason: 'stop',
        metadata: { reasoningSignature: 'sig-xyz' },
      });
    });

    it('omits metadata from provider_stream_done when no signature_delta occurred', async () => {
      const sse = [
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
      ].join('\n');

      const fetchFn = vi.fn(() =>
        Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sse));
              controller.close();
            },
          }),
        } as Response)
      );
      const provider = new AnthropicProvider({ baseURL: 'http://mock', fetch: fetchFn });

      const chunks: ProviderStreamChunk[] = [];
      for await (const chunk of provider.chatStream(req())) chunks.push(chunk);

      const done = chunks.find((c: ProviderStreamChunk) => c.type === 'provider_stream_done');
      expect(done).toEqual({ type: 'provider_stream_done', finishReason: 'stop' });
    });
  });

  describe('AnthropicProvider::Reasoning::Serialize', () => {
    async function capture(messages: ChatMessage[]) {
      let capturedBody: unknown;
      const fetchFn = vi.fn<typeof fetch>((_url, init) => {
        capturedBody = JSON.parse(init!.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'x',
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: 'ok' }],
              stop_reason: 'end_turn',
            }),
          text: () => Promise.resolve(''),
        } as Response);
      });
      const provider = new AnthropicProvider({ baseURL: 'http://mock', fetch: fetchFn });
      await provider.chat(req({ messages }));
      return (capturedBody as { messages: { role: string; content: unknown }[] }).messages;
    }

    it('emits thinking block when assistant message has reasoning + signature + tool calls', async () => {
      const messages = await capture([
        {
          role: 'assistant',
          content: 'calling',
          reasoning: 'why I call',
          metadata: { reasoningSignature: 'sig-abc' },
          calls: [{ id: 'c1', name: 'x', arguments: {} }],
        },
      ]);

      expect(messages[0]!.content).toEqual([
        { type: 'thinking', thinking: 'why I call', signature: 'sig-abc' },
        { type: 'text', text: 'calling' },
        { type: 'tool_use', id: 'c1', name: 'x', input: {} },
      ]);
    });

    it('drops thinking block when assistant message has no tool calls', async () => {
      const messages = await capture([
        {
          role: 'assistant',
          content: 'hi',
          reasoning: 'my thought',
          metadata: { reasoningSignature: 'sig' },
        },
      ]);

      expect(messages[0]!.content).not.toContainEqual(
        expect.objectContaining({ type: 'thinking' })
      );
    });

    it('drops thinking block when reasoningSignature is missing from metadata', async () => {
      const messages = await capture([
        {
          role: 'assistant',
          content: 'calling',
          reasoning: 'my thought',
          calls: [{ id: 'c1', name: 'x', arguments: {} }],
        },
      ]);

      expect(messages[0]!.content).not.toContainEqual(
        expect.objectContaining({ type: 'thinking' })
      );
    });

    it('drops thinking block when reasoning is missing', async () => {
      const messages = await capture([
        {
          role: 'assistant',
          content: 'calling',
          metadata: { reasoningSignature: 'sig' },
          calls: [{ id: 'c1', name: 'x', arguments: {} }],
        },
      ]);

      expect(messages[0]!.content).not.toContainEqual(
        expect.objectContaining({ type: 'thinking' })
      );
    });
  });
});
