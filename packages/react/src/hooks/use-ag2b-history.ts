import type { ChatMessage } from '@ag2b/core';
import { useSyncExternalStore } from 'react';

import { useAg2bContext } from '@/provider';

/**
 * Reactive snapshot of the conversation history. Re-renders on push or
 * reset. The returned array reference is stable between mutations. SSR-safe.
 */
export const useAg2bHistory = (): ChatMessage[] => {
  const agent = useAg2bContext();
  return useSyncExternalStore(
    agent.history.subscribe,
    agent.history.getSnapshot,
    agent.history.getSnapshot
  );
};
