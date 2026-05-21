import type { AgentEvent, AgentResponse, AssistantMessage } from '@ag2b/core';
import { useCallback, useMemo, useState } from 'react';

import { useChatRunner } from '@/internal';
import { useAg2bContext } from '@/provider';

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
 * `pendingMessage` exposes the in-flight assistant turn. It's `null` whenever
 * the latest event isn't a content/reasoning delta — between iterations,
 * during tool execution, and after `agent_chat_done` — so consumers can
 * splice it alongside `useAg2bHistory` without duplicating the committed turn.
 *
 * Tool errors surface as `agent_tool_call_error` events. Only a thrown
 * exception out of the iterator sets `error`.
 */
export const useAg2bChatStream = (): UseAg2bChatStreamReturn => {
  const agent = useAg2bContext();
  const [content, setContent] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [response, setResponse] = useState<AgentResponse | undefined>(undefined);
  const runner = useChatRunner<AgentResponse>();

  const send = useCallback(
    (message: string): Promise<AgentResponse | undefined> => {
      setContent('');
      setReasoning('');
      setEvents([]);
      return runner.start(async (signal) => {
        let final: AgentResponse | undefined;
        let pendingReset = false;
        for await (const event of agent.chatStream(message, signal)) {
          setEvents((prev) => [...prev, event]);
          switch (event.type) {
            case 'agent_content_delta':
              if (pendingReset) {
                setContent(event.delta);
                setReasoning('');
                pendingReset = false;
              } else {
                setContent((c) => c + event.delta);
              }
              break;
            case 'agent_reasoning_delta':
              if (pendingReset) {
                setReasoning(event.delta);
                setContent('');
                pendingReset = false;
              } else {
                setReasoning((r) => r + event.delta);
              }
              break;
            case 'agent_content_end':
              pendingReset = true;
              break;
            case 'agent_chat_done':
              final = event.response;
              setResponse(event.response);
              break;
            default:
              break;
          }
        }
        if (!final) throw new Error('stream ended without agent_chat_done');
        return final;
      });
    },
    [agent, runner]
  );

  const pendingMessage = useMemo<AssistantMessage | null>(() => {
    const lastType = events.at(-1)?.type;
    if (lastType !== 'agent_content_delta' && lastType !== 'agent_reasoning_delta') {
      return null;
    }
    return {
      role: 'assistant',
      content: content || undefined,
      reasoning: reasoning || undefined,
    };
  }, [events, content, reasoning]);

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
