import type { AgentHooks } from '@ag2b/core';
import { useEffect } from 'react';

import { useEventCallback } from '@/internal';
import { useAg2bContext } from '@/provider';

/**
 * Register an agent lifecycle hook for the component's lifetime. The callback
 * is auto-pinned — inline arrows read the latest closure on each event
 * without re-registering.
 */
export const useAg2bHook = <K extends keyof AgentHooks>(event: K, hook: AgentHooks[K]): void => {
  const agent = useAg2bContext();
  const stableHook = useEventCallback(hook);
  useEffect(() => agent.addHook(event, stableHook), [agent, event, stableHook]);
};
