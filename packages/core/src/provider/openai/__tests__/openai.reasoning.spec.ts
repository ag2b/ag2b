import type { ProviderStreamChunk } from '../../streamable.provider';
import { OpenAiProvider } from '../openai.provider';
import { req } from './fixtures';

describe('OpenAiProvider::Reasoning', () => {
  it('parses reasoning_content from sync response', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'x',
            object: 'chat.completion',
            model: 'deepseek-r1',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Answer',
                  reasoning_content: 'Thinking…',
                },
                finish_reason: 'stop',
              },
            ],
          }),
        text: () => Promise.resolve(''),
      } as Response)
    );
    const provider = new OpenAiProvider({ baseURL: 'http://mock', fetch: fetchFn });
    const response = await provider.chat(req());
    expect(response.reasoning).toBe('Thinking…');
  });

  it('emits provider_reasoning_delta from stream reasoning_content deltas', async () => {
    const sse = [
      'data: {"id":"x","choices":[{"index":0,"delta":{"reasoning_content":"Let me "},"finish_reason":null}]}',
      'data: {"id":"x","choices":[{"index":0,"delta":{"reasoning_content":"think…"},"finish_reason":null}]}',
      'data: {"id":"x","choices":[{"index":0,"delta":{"content":"Answer"},"finish_reason":null}]}',
      'data: {"id":"x","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      'data: [DONE]',
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
    const provider = new OpenAiProvider({ baseURL: 'http://mock', fetch: fetchFn });

    const chunks: ProviderStreamChunk[] = [];
    for await (const chunk of provider.chatStream(req())) chunks.push(chunk);

    expect(chunks.filter((c) => c.type === 'provider_reasoning_delta')).toEqual([
      { type: 'provider_reasoning_delta', delta: 'Let me ' },
      { type: 'provider_reasoning_delta', delta: 'think…' },
    ]);
  });

  it('does NOT include reasoning in the outbound wire body', async () => {
    let capturedBody: unknown;
    const fetchFn = vi.fn<typeof fetch>((_url, init) => {
      capturedBody = JSON.parse(init!.body as string);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'x',
            object: 'chat.completion',
            model: 'm',
            choices: [
              { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
            ],
          }),
        text: () => Promise.resolve(''),
      } as Response);
    });

    const provider = new OpenAiProvider({ baseURL: 'http://mock', fetch: fetchFn });
    await provider.chat(
      req({
        messages: [
          {
            role: 'assistant',
            content: 'prior',
            reasoning: 'thought',
            metadata: { reasoningSignature: 'sig' },
          },
        ],
      })
    );

    const sentMessages = (capturedBody as { messages: unknown[] }).messages;
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).not.toHaveProperty('reasoning_content');
  });

  it('reads reasoning from a custom field name (sync)', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'x',
            object: 'chat.completion',
            model: 'openrouter',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Answer',
                  reasoning: 'Thinking via OpenRouter…',
                },
                finish_reason: 'stop',
              },
            ],
          }),
        text: () => Promise.resolve(''),
      } as Response)
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://mock',
      fetch: fetchFn,
      reasoningField: 'reasoning',
    });
    const response = await provider.chat(req());
    expect(response.reasoning).toBe('Thinking via OpenRouter…');
  });

  it('reads reasoning from a custom field name (stream)', async () => {
    const sse = [
      'data: {"id":"x","choices":[{"index":0,"delta":{"reasoning":"Let me "},"finish_reason":null}]}',
      'data: {"id":"x","choices":[{"index":0,"delta":{"reasoning":"think…"},"finish_reason":null}]}',
      'data: {"id":"x","choices":[{"index":0,"delta":{"content":"Answer"},"finish_reason":null}]}',
      'data: {"id":"x","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      'data: [DONE]',
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
    const provider = new OpenAiProvider({
      baseURL: 'http://mock',
      fetch: fetchFn,
      reasoningField: 'reasoning',
    });

    const chunks: ProviderStreamChunk[] = [];
    for await (const chunk of provider.chatStream(req())) chunks.push(chunk);

    expect(chunks.filter((c) => c.type === 'provider_reasoning_delta')).toEqual([
      { type: 'provider_reasoning_delta', delta: 'Let me ' },
      { type: 'provider_reasoning_delta', delta: 'think…' },
    ]);
  });

  it('returns undefined when configured field is missing on the message', async () => {
    // reasoningField points at 'reasoning' but the payload only has 'reasoning_content'.
    const fetchFn = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'x',
            object: 'chat.completion',
            model: 'm',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Answer',
                  reasoning_content: 'wrong field',
                },
                finish_reason: 'stop',
              },
            ],
          }),
        text: () => Promise.resolve(''),
      } as Response)
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://mock',
      fetch: fetchFn,
      reasoningField: 'reasoning',
    });
    const response = await provider.chat(req());
    expect(response.reasoning).toBeUndefined();
  });

  it('returns undefined when the configured field holds a non-string value', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'x',
            object: 'chat.completion',
            model: 'm',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Answer',
                  // Object instead of string — extractor must NOT crash and must return undefined.
                  reasoning: { summary: 'nope' },
                },
                finish_reason: 'stop',
              },
            ],
          }),
        text: () => Promise.resolve(''),
      } as Response)
    );
    const provider = new OpenAiProvider({
      baseURL: 'http://mock',
      fetch: fetchFn,
      reasoningField: 'reasoning',
    });
    const response = await provider.chat(req());
    expect(response.reasoning).toBeUndefined();
  });

  it('treats empty-string reasoning as undefined (sync)', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'x',
            object: 'chat.completion',
            model: 'm',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'Answer',
                  reasoning_content: '',
                },
                finish_reason: 'stop',
              },
            ],
          }),
        text: () => Promise.resolve(''),
      } as Response)
    );
    const provider = new OpenAiProvider({ baseURL: 'http://mock', fetch: fetchFn });
    const response = await provider.chat(req());
    expect(response.reasoning).toBeUndefined();
  });
});
