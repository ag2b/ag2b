import type { AgentEvent, AgentResponse } from '@ag2b/core';
import { useCallback, useState } from 'react';

import { useChatRunner } from '@/internal';
import { useAg2bContext } from '@/provider';

export type UseAg2bChatReturn = {
  /** Send a user message. Aborts any prior in-flight call. Resolves to the final response, or `undefined` if aborted/superseded/threw. */
  send: (message: string) => Promise<AgentResponse | undefined>;
  /** Final response from the most recent successful send. */
  response: AgentResponse | undefined;
  /** Boundary events emitted during the in-flight send. Resets on each `send()`. */
  events: AgentEvent[];
  /** True while a send is in flight. */
  isPending: boolean;
  /** Last non-abort error from a chat, or `undefined`. Cleared on each `send`. */
  error: unknown;
  /** Cancel the in-flight call. Clean cancel — does not set `error`. */
  abort: () => void;
};

/**
 * Stateful chat hook backed by {@link Agent.chat}. Subscribes to boundary
 * events via `chat({ onEvent })`. Auto-aborts on resend and unmount.
 * `abort()` doesn't set `error`.
 */
export const useAg2bChat = (): UseAg2bChatReturn => {
  const agent = useAg2bContext();
  const [response, setResponse] = useState<AgentResponse | undefined>(undefined);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const runner = useChatRunner<AgentResponse>();

  const send = useCallback(
    async (message: string): Promise<AgentResponse | undefined> => {
      setEvents([]);
      const result = await runner.start((signal) =>
        agent.chat(message, {
          signal,
          onEvent: (event) => setEvents((prev) => [...prev, event]),
        })
      );
      if (result) setResponse(result);
      return result;
    },
    [agent, runner]
  );

  return {
    send,
    response,
    events,
    isPending: runner.isRunning,
    error: runner.error,
    abort: runner.abort,
  };
};
