import type { Agent } from '@ag2b/core';

import { useAg2bContext } from '@/provider';

/**
 * Returns the {@link Agent} provided by the surrounding {@link Ag2bProvider}.
 * Use when you need imperative access — e.g. calling `agent.chat()` from a
 * non-React handler.
 *
 * Reads aren't reactive. `useAg2bAgent().history.getSnapshot()` doesn't
 * re-render on history changes. Use {@link useAg2bHistory} for reactive
 * reads.
 *
 * @throws ContextError when used outside an {@link Ag2bProvider}.
 */
export const useAg2bAgent = (): Agent => useAg2bContext();
