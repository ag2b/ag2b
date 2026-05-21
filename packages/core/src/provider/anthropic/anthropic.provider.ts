import { Ag2bProviderRequestError, Ag2bProviderResponseError } from '@/errors';
import type { AssistantToolCall, ChatMessage, FinishReason } from '@/messages';
import type { Tool } from '@/tool';

import type { ProviderConfig, ProviderRequest, ProviderResponse } from '../abstract.provider';
import type { ProviderStreamChunk } from '../streamable.provider';
import { StreamableProvider } from '../streamable.provider';
import type {
  AnthropicMessage,
  AnthropicResponse,
  AnthropicStopReason,
  AnthropicStreamEvent,
  AnthropicTextBlock,
  AnthropicThinkingBlock,
  AnthropicTool,
  AnthropicToolResultBlock,
  AnthropicToolUseBlock,
  AnthropicUserMessage,
} from './anthropic.types';

/** SSE line prefix for data frames. */
const SSE_DATA_PREFIX = 'data: ';

/** Configuration for {@link AnthropicProvider}. */
export type AnthropicProviderConfig = ProviderConfig & {
  /**
   * Model name passed in the request body's `model` field (e.g. `"claude-sonnet-4-6"`).
   * When omitted, no `model` field is sent — a proxy endpoint may inject it; direct
   * calls to the Anthropic API will be rejected.
   */
  model?: string;
  /**
   * Maximum tokens to generate, passed in the request body's `max_tokens` field.
   * When omitted, no `max_tokens` field is sent — a proxy endpoint may inject it;
   * direct calls to the Anthropic API will be rejected.
   */
  maxTokens?: number;
  /**
   * Extended-thinking config. When `enabled`, sends `thinking: { type: 'enabled',
   * budget_tokens }` in the request body so Claude emits reasoning blocks.
   */
  thinking?: { enabled: boolean; budgetTokens: number };
};

/**
 * Provider for the Anthropic Messages API.
 *
 * Maps ag2b's normalized message types to Anthropic's `/v1/messages` format
 * (content-block arrays, separate `system` param, tool_use/tool_result blocks)
 * and parses responses back into {@link ProviderResponse}.
 */
export class AnthropicProvider extends StreamableProvider {
  protected readonly model?: string;
  protected readonly maxTokens?: number;
  protected readonly thinking?: { enabled: boolean; budgetTokens: number };

  constructor(config: AnthropicProviderConfig) {
    super(config);
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.thinking = config.thinking;
  }

  public async runChat(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse> {
    const response = await this.fetch(this.baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.buildRequestBody(request, false)),
      signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => undefined);

      throw new Ag2bProviderRequestError(
        `Request failed with status ${response.status}`,
        response.status,
        body
      );
    }

    const body = (await response.json()) as AnthropicResponse;
    return this.parseResponse(body);
  }

  public async *runChatStream(
    request: ProviderRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ProviderStreamChunk> {
    const response = await this.fetch(this.baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.buildRequestBody(request, true)),
      signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      throw new Ag2bProviderRequestError(
        `Request failed with status ${response.status}`,
        response.status,
        body
      );
    }

    yield* this.parseSSE(response);
  }

  /** Build the JSON request body shared between chat() and chatStream(). */
  private buildRequestBody(request: ProviderRequest, stream: boolean) {
    return {
      ...(this.model !== undefined ? { model: this.model } : {}),
      ...(this.maxTokens !== undefined ? { max_tokens: this.maxTokens } : {}),
      ...(this.thinking?.enabled
        ? { thinking: { type: 'enabled', budget_tokens: this.thinking.budgetTokens } }
        : {}),
      ...(request.system ? { system: request.system } : {}),
      messages: this.mapMessagesToAnthropic(request.messages),
      ...(request.tools.length > 0 ? { tools: this.mapToolsToAnthropic(request.tools) } : {}),
      stream,
    };
  }

  /**
   * Map ag2b normalized messages to Anthropic message format.
   *
   * Anthropic does not have a `tool` role — tool results are sent as `user` messages
   * with `tool_result` content blocks. Consecutive tool messages (e.g. parallel tool
   * calls) are merged into a single user message to preserve role alternation.
   */
  private mapMessagesToAnthropic(messages: ChatMessage[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];

    for (const message of messages) {
      if (message.role === 'tool') {
        const block: AnthropicToolResultBlock = {
          type: 'tool_result',
          tool_use_id: message.id,
          content: message.content,
        };

        const last = result[result.length - 1];
        if (last?.role === 'user' && Array.isArray(last.content)) {
          last.content.push(block);
        } else {
          result.push({ role: 'user', content: [block] });
        }
      } else if (message.role === 'assistant') {
        const blocks: (AnthropicThinkingBlock | AnthropicTextBlock | AnthropicToolUseBlock)[] = [];

        // Anthropic requires signed thinking blocks to be echoed back when the turn
        // also has tool_use — otherwise the API returns 400. Drop the block if any
        // of reasoning / signature / toolCalls is missing: without a signature we
        // can't echo; without tool_use the block is not required.
        const signature = message.metadata?.reasoningSignature as string | undefined;
        const emitThinking =
          Boolean(message.reasoning) && Boolean(signature) && Boolean(message.calls?.length);

        if (emitThinking) {
          blocks.push({
            type: 'thinking',
            thinking: message.reasoning!,
            signature: signature!,
          });
        }

        if (message.content) {
          blocks.push({ type: 'text', text: message.content });
        }

        if (message.calls) {
          for (const call of message.calls) {
            blocks.push({
              type: 'tool_use',
              id: call.id,
              name: call.name,
              input: call.arguments,
            });
          }
        }

        result.push({ role: 'assistant', content: blocks });
      } else {
        const userMessage: AnthropicUserMessage = {
          role: 'user',
          content: message.content,
        };
        result.push(userMessage);
      }
    }

    return result;
  }

  /** Map ag2b Tool instances to Anthropic's tool format. */
  private mapToolsToAnthropic(tools: Tool[]): AnthropicTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.schema,
    }));
  }

  /** Normalize Anthropic's stop reason to ag2b's {@link FinishReason}. Unknown/null reasons default to `'stop'`. */
  private parseStopReason(reason: AnthropicStopReason): FinishReason {
    switch (reason) {
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      case 'end_turn':
      case 'stop_sequence':
      default:
        return 'stop';
    }
  }

  /** Parse the full Anthropic JSON response into a normalized {@link ProviderResponse}. */
  private parseResponse(response: AnthropicResponse): ProviderResponse {
    let content: string | undefined;
    let reasoning: string | undefined;
    let signature: string | undefined;
    const toolCalls: AssistantToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content = (content ?? '') + block.text;
      } else if (block.type === 'thinking') {
        reasoning = (reasoning ?? '') + block.thinking;
        // If multiple thinking blocks appear (rare), the last signature wins.
        // In practice Anthropic emits a single thinking block per turn.
        signature = block.signature;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    }

    return {
      content,
      reasoning,
      metadata: signature ? { reasoningSignature: signature } : undefined,
      calls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.parseStopReason(response.stop_reason),
    };
  }

  /** Parse an SSE response stream into {@link ProviderStreamChunk} events. */
  private async *parseSSE(response: Response): AsyncGenerator<ProviderStreamChunk> {
    if (!response.body) {
      throw new Ag2bProviderResponseError(
        'Response body is null — streaming requires a readable body'
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reasoningSignature: string | undefined;
    const setSignature = (sig: string) => {
      reasoningSignature = sig;
    };
    const getSignature = () => reasoningSignature;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // incomplete line goes back to buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed.startsWith(SSE_DATA_PREFIX)) continue;

          const event = JSON.parse(trimmed.slice(SSE_DATA_PREFIX.length)) as AnthropicStreamEvent;
          yield* this.mapStreamEvent(event, setSignature, getSignature);
        }
      }

      // Flush any final line that had no trailing newline.
      const trailing = buffer.trim();
      if (trailing.startsWith(SSE_DATA_PREFIX)) {
        const event = JSON.parse(trailing.slice(SSE_DATA_PREFIX.length)) as AnthropicStreamEvent;
        yield* this.mapStreamEvent(event, setSignature, getSignature);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Map a single SSE event to zero or more {@link ProviderStreamChunk} events. */
  private *mapStreamEvent(
    event: AnthropicStreamEvent,
    setSignature: (sig: string) => void,
    getSignature: () => string | undefined
  ): Generator<ProviderStreamChunk> {
    switch (event.type) {
      case 'content_block_start':
        if (event.content_block.type === 'tool_use') {
          yield {
            type: 'provider_tool_call_delta',
            index: event.index,
            id: event.content_block.id,
            name: event.content_block.name,
            argumentsDelta: '',
          };
        }
        // thinking content_block_start → no-op (deltas carry the payload)
        break;

      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          yield { type: 'provider_content_delta', delta: event.delta.text };
        } else if (event.delta.type === 'thinking_delta') {
          yield { type: 'provider_reasoning_delta', delta: event.delta.thinking };
        } else if (event.delta.type === 'signature_delta') {
          setSignature(event.delta.signature);
        } else if (event.delta.type === 'input_json_delta') {
          yield {
            type: 'provider_tool_call_delta',
            index: event.index,
            argumentsDelta: event.delta.partial_json,
          };
        }
        break;

      case 'message_delta':
        if (event.delta.stop_reason) {
          const sig = getSignature();
          yield {
            type: 'provider_stream_done',
            finishReason: this.parseStopReason(event.delta.stop_reason),
            ...(sig ? { metadata: { reasoningSignature: sig } } : {}),
          };
        }
        break;

      case 'error':
        throw new Ag2bProviderResponseError(`Stream error: ${event.error.message}`, event.error);

      // message_start, content_block_stop, message_stop, ping — ignored
    }
  }
}
