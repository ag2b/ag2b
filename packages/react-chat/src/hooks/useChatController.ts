import type { AssistantMessage } from '@ag2b/core';
import { useAg2bChat, useAg2bChatStream } from '@ag2b/react';
import { useEffect, useRef } from 'react';

import type { Ag2bPopupMode } from '@/types';

export type ChatController = {
  send: (message: string) => Promise<unknown>;
  abort: () => void;
  isPending: boolean;
  error: unknown;
  /** Non-null only in streaming mode between deltas. */
  pendingMessage: AssistantMessage | null;
};

export const useChatController = ({ mode }: { mode: Ag2bPopupMode }): ChatController => {
  const sync = useAg2bChat();
  const stream = useAg2bChatStream();

  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    if (prevModeRef.current === 'streaming' && stream.isPending) stream.abort();
    if (prevModeRef.current === 'synchronous' && sync.isPending) sync.abort();
    prevModeRef.current = mode;
  }, [mode, stream, sync]);

  if (mode === 'streaming') {
    return {
      send: stream.send,
      abort: stream.abort,
      isPending: stream.isPending,
      error: stream.error,
      pendingMessage: stream.pendingMessage,
    };
  }
  return {
    send: sync.send,
    abort: sync.abort,
    isPending: sync.isPending,
    error: sync.error,
    pendingMessage: null,
  };
};
