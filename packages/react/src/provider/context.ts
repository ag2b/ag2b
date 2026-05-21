import type { Agent } from '@ag2b/core';

import { createContext } from '@/internal';

/** @internal React context and hook for accessing the agent. */
export const [Ag2bContext, useAg2bContext] = createContext<Agent>();
