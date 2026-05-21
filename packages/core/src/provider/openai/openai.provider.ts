import { Ag2bProviderRequestError, Ag2bProviderResponseError } from '@/errors';
import type { AssistantToolCall, ChatMessage, FinishReason } from '@/messages';
import type { Tool } from '@/tool';

import type { ProviderConfig, ProviderRequest, ProviderResponse } from '../abstract.provider';
import type { ProviderStreamChunk } from '../streamable.provider';
import { StreamableProvider } from '../streamable.provider';
import type {
  OpenAiFinishReason,
  OpenAiMessage,
  OpenAiResponse,
  OpenAiStreamChunk,
  OpenAiSystemMessage,
  OpenAiTool,
  OpenAiToolCall,
} from './openai.types';

/** SSE line prefix for data frames. */
const SSE_DATA_PREFIX = 'data: ';
/** SSE termination signal from OpenAI. */
const SSE_DONE = 'data: [DONE]';

/** Configuration for {@link OpenAiProvider}. */
export type OpenAiProviderConfig = ProviderConfig & {
  /**
   * Model name passed in the request body's `model` field,
   */
  model?: string;
  /**
   * Property name on `choice.message` and `choice.delta` to read as reasoning text.
   *
   * - `'reasoning_content'` (default) — DeepSeek-R1 / DeepSeek-V3 thinking convention.
   * - `'reasoning'` — OpenRouter convention.
   * - any other string — custom field name.
   */
  reasoningField?: string;
};

/**
 * Provider for OpenAI-compatible APIs.
 *
 * Maps ag2b's normalized message types to OpenAI's `/chat/completions` format
 * and parses responses back into {@link ProviderResponse}.
 */
export class OpenAiProvider extends StreamableProvider {
  protected readonly model?: string;
  protected readonly reasoningField: string;

  constructor(config: OpenAiProviderConfig) {
    super(config);
    this.model = config.model;
    this.reasoningField = config.reasoningField ?? 'reasoning_content';
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

    const body = (await response.json()) as OpenAiResponse;
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
      messages: [
        ...(request.system ? [this.createSystemMessage(request.system)] : []),
        ...this.mapMessagesToOpenAi(request.messages),
      ],
      ...(request.tools.length > 0 ? { tools: this.mapToolsToOpenAi(request.tools) } : {}),
      stream,
    };
  }

  /** Create an OpenAI system message. */
  private createSystemMessage(content: string): OpenAiSystemMessage {
    return {
      role: 'system',
      content,
    };
  }

  /** Map ag2b normalized messages to OpenAI message format. */
  private mapMessagesToOpenAi(messages: ChatMessage[]): OpenAiMessage[] {
    return messages.map((message) => {
      if (message.role === 'assistant') {
        return {
          role: message.role,
          content: message.content ?? null,
          tool_calls: message.calls?.map(this.mapToolCallToOpenAi),
        };
      } else if (message.role === 'tool') {
        return {
          role: message.role,
          content: message.content,
          tool_call_id: message.id,
        };
      } else {
        return message;
      }
    });
  }

  /** Map a single ag2b ToolCall to OpenAI's function call format. */
  private mapToolCallToOpenAi(this: void, call: AssistantToolCall): OpenAiToolCall {
    return {
      id: call.id,
      type: 'function',
      function: {
        name: call.name,
        arguments: JSON.stringify(call.arguments),
      },
    };
  }

  /** Map ag2b Tool instances to OpenAI's function tool format. */
  private mapToolsToOpenAi(tools: Tool[]): OpenAiTool[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
      },
    }));
  }

  /** Normalize OpenAI's finish reason to ag2b's {@link FinishReason}. Unknown reasons default to `'stop'`. */
  private parseFinishReason(reason: OpenAiFinishReason): FinishReason {
    if (reason === 'stop' || reason === 'tool_calls' || reason === 'length') {
      return reason;
    } else {
      return 'stop';
    }
  }

  /**
   * Extract reasoning text from a message or delta object using the configured
   * field name. Returns undefined when the field is absent, null, non-string,
   * or empty.
   */
  private extractReasoning(source: object | undefined): string | undefined {
    if (!source) return undefined;
    const value = (source as Record<string, unknown>)[this.reasoningField];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  /** Parse the full OpenAI JSON response into a normalized {@link ProviderResponse}. */
  private parseResponse(response: OpenAiResponse): ProviderResponse {
    const [choice] = response.choices;

    if (!choice) {
      throw new Ag2bProviderResponseError('Empty choices in response', response);
    }

    return {
      content: choice.message.content ?? undefined,
      reasoning: this.extractReasoning(choice.message),
      calls: choice.message.tool_calls?.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: this.parseToolArguments(call.function.name, call.function.arguments),
      })),
      finishReason: this.parseFinishReason(choice.finish_reason),
    };
  }

  /** Parse a tool call's JSON arguments string. */
  private parseToolArguments(name: string, raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Ag2bProviderResponseError(`Failed to parse arguments for tool "${name}"`, raw);
    }
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

          if (trimmed === SSE_DONE) {
            return;
          }

          if (!trimmed.startsWith(SSE_DATA_PREFIX)) continue;

          const chunk = JSON.parse(trimmed.slice(SSE_DATA_PREFIX.length)) as OpenAiStreamChunk;
          yield* this.mapStreamChunk(chunk);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Map a single SSE chunk to one or more {@link ProviderStreamChunk} events. */
  private *mapStreamChunk(chunk: OpenAiStreamChunk): Generator<ProviderStreamChunk> {
    const choice = chunk.choices[0];
    if (!choice) return;

    const reasoning = this.extractReasoning(choice.delta);
    if (reasoning) {
      yield { type: 'provider_reasoning_delta', delta: reasoning };
    }

    if (choice.delta.content) {
      yield { type: 'provider_content_delta', delta: choice.delta.content };
    }

    if (choice.delta.tool_calls) {
      for (const call of choice.delta.tool_calls) {
        yield {
          type: 'provider_tool_call_delta',
          index: call.index,
          id: call.id,
          name: call.function?.name,
          argumentsDelta: call.function?.arguments ?? '',
        };
      }
    }

    if (choice.finish_reason) {
      yield {
        type: 'provider_stream_done',
        finishReason: this.parseFinishReason(choice.finish_reason),
      };
    }
  }
}
