import type { Agent } from '@ag2b/core';
import React from 'react';

import { Ag2bContext } from './context';

/** Props for {@link Ag2bProvider}. */
export type Ag2bProviderProps = { agent: Agent };

/**
 * React context provider that makes the agent available to child components.
 */
export const Ag2bProvider: React.FC<React.PropsWithChildren<Ag2bProviderProps>> = ({
  agent,
  children,
}) => {
  return <Ag2bContext.Provider value={agent}>{children}</Ag2bContext.Provider>;
};
