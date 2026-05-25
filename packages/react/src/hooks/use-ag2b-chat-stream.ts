import type { AgentEvent, AgentResponse, AssistantMessage } from '@ag2b/core';
import { useCallback, useMemo, useState } from 'react';

import { useChatRunner } from '@/internal';
import { useAg2bContext } from '@/provider';

/** Per-index accumulator for a tool call as its chunks stream in. */
type ToolCallBuffer = { index: number; id: string; name: string; arguments: string };

/** Best-effort parse of a partial arguments JSON string — falls back to `{}` until it's valid. */
const parseArgs = (raw: string): Record<string, unknown> => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const applyToolCallDelta = (
  buffers: ToolCallBuffer[],
  event: Extract<AgentEvent, { type: 'agent_tool_call_delta' }>
): ToolCallBuffer[] => {
  const i = buffers.findIndex((b) => b.index === event.index);
  if (i === -1) {
    return [
      ...buffers,
      {
        index: event.index,
        id: event.id ?? '',
        name: event.name ?? '',
        arguments: event.argumentsDelta,
      },
    ];
  }
  const next = buffers.slice();
  next[i] = { ...next[i]!, arguments: next[i]!.arguments + event.argumentsDelta };
  return next;
};

/**
 * Reconstruct the in-flight assistant turn from the event log. Returns `null`
 * unless the latest event is a delta — i.e. between iterations, during tool
 * execution, and after the stream completes. Accumulates only the current turn:
 * everything after the last committed assistant message (`agent_content_end`).
 */
const buildPendingMessage = (events: AgentEvent[]): AssistantMessage | null => {
  const last = events.at(-1)?.type;
  if (
    last !== 'agent_content_delta' &&
    last !== 'agent_reasoning_delta' &&
    last !== 'agent_tool_call_delta'
  ) {
    return null;
  }

  let start = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.type === 'agent_content_end') {
      start = i + 1;
      break;
    }
  }

  let content = '';
  let reasoning = '';
  let buffers: ToolCallBuffer[] = [];
  for (let i = start; i < events.length; i++) {
    const event = events[i]!;
    if (event.type === 'agent_content_delta') content += event.delta;
    else if (event.type === 'agent_reasoning_delta') reasoning += event.delta;
    else if (event.type === 'agent_tool_call_delta') buffers = applyToolCallDelta(buffers, event);
  }

  return {
    role: 'assistant',
    content: content || undefined,
    reasoning: reasoning || undefined,
    calls: buffers.length
      ? buffers.map((call) => ({
          id: call.id,
          name: call.name,
          arguments: parseArgs(call.arguments),
        }))
      : undefined,
  };
};

export type UseAg2bChatStreamReturn = {
  /** Send a user message. Aborts any prior in-flight call. Resolves to the final response, or `undefined` if aborted/superseded/threw. */
  send: (message: string) => Promise<AgentResponse | undefined>;
  /** Final response from the most recent successful send. Persists across the start of subsequent sends until they complete. */
  response: AgentResponse | undefined;
  /**
   * The in-flight assistant turn while deltas are arriving. `null` between
   * iterations, during tool execution, and after the stream completes.
   * Splice with `useAg2bHistory` via `[...messages, pendingMessage].filter(Boolean)`
   * without duplicating the just-committed turn.
   */
  pendingMessage: AssistantMessage | null;
  /** All events emitted in the current send, in order. Resets on each `send()`. */
  events: AgentEvent[];
  /** True while a stream is in flight. */
  isPending: boolean;
  /** Last non-abort error from a stream, or `undefined`. Cleared on each `send`. */
  error: unknown;
  /** Cancel the in-flight stream. Clean cancel — does not set `error`. */
  abort: () => void;
};

/**
 * Stateful streaming-chat hook backed by {@link Agent.chatStream}.
 *
 * `pendingMessage` exposes the in-flight assistant turn, derived from the event
 * log. It's `null` whenever the latest event isn't a content, reasoning, or
 * tool-call delta — between iterations, during tool execution, and after
 * `agent_chat_done` — so consumers can splice it alongside `useAg2bHistory`
 * without duplicating the committed turn.
 *
 * Tool errors surface as `agent_tool_call_error` events. Only a thrown
 * exception out of the iterator sets `error`.
 */
export const useAg2bChatStream = (): UseAg2bChatStreamReturn => {
  const agent = useAg2bContext();
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [response, setResponse] = useState<AgentResponse | undefined>(undefined);
  const runner = useChatRunner<AgentResponse>();

  const send = useCallback(
    (message: string): Promise<AgentResponse | undefined> => {
      setEvents([]);
      return runner.start(async (signal) => {
        let final: AgentResponse | undefined;
        for await (const event of agent.chatStream(message, signal)) {
          setEvents((prev) => [...prev, event]);
          if (event.type === 'agent_chat_done') {
            final = event.response;
            setResponse(event.response);
          }
        }
        if (!final) throw new Error('stream ended without agent_chat_done');
        return final;
      });
    },
    [agent, runner]
  );

  const pendingMessage = useMemo<AssistantMessage | null>(
    () => buildPendingMessage(events),
    [events]
  );

  return {
    send,
    response,
    pendingMessage,
    events,
    isPending: runner.isRunning,
    error: runner.error,
    abort: runner.abort,
  };
};
