import type { Scope } from '@ag2b/core';
import { useSyncExternalStore } from 'react';

import { useAg2bContext } from '@/provider';

/**
 * Reactive snapshot of the agent's registered scopes. Re-renders when a
 * scope is registered or unregistered. The returned array reference is
 * stable between mutations. SSR-safe.
 */
export const useAg2bScopes = (): Scope[] => {
  const agent = useAg2bContext();
  return useSyncExternalStore(
    agent.scopes.subscribe,
    agent.scopes.getSnapshot,
    agent.scopes.getSnapshot
  );
};
