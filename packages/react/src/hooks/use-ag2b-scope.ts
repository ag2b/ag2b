import type { ScopeConfig } from '@ag2b/core';
import { Scope } from '@ag2b/core';
import { useEffect, useMemo } from 'react';

import { useEventCallback, useStableArray } from '@/internal';
import { useAg2bContext } from '@/provider';

const noopTrue = (): boolean => true;
const noopUndefined = (): unknown => undefined;

/**
 * Register a {@link Scope} on the surrounding agent for the component's
 * lifetime. `enabled` and `context` are auto-pinned — inline arrows are safe
 * to read reactive state.
 *
 * Stable per mount. Tool re-creation auto-cascades via reference tracking, so
 * tools don't need to be listed in `deps`. Pass `deps` only to force a
 * re-register from external state the config doesn't read.
 *
 * @example
 * ```tsx
 * const tool = useAg2bTool({ ... }, [maxLen]);
 * useAg2bScope({ name: 'posts', tools: [tool] });
 * ```
 */
export const useAg2bScope = (config: ScopeConfig, deps: unknown[] = []): void => {
  const agent = useAg2bContext();

  const enabledStable = useEventCallback(config.enabled ?? noopTrue);
  const contextStable = useEventCallback(config.context ?? noopUndefined);
  const toolsStable = useStableArray(config.tools ?? []);

  const hasEnabled = config.enabled !== undefined;
  const hasContext = config.context !== undefined;

  const scope = useMemo(
    () =>
      new Scope({
        name: config.name,
        label: config.label,
        injection: config.injection,
        tools: toolsStable,
        enabled: hasEnabled ? enabledStable : undefined,
        context: hasContext ? contextStable : undefined,
      }),
    [
      config.name,
      config.label,
      config.injection,
      toolsStable,
      enabledStable,
      contextStable,
      ...deps,
    ]
  );

  useEffect(() => agent.scopes.register(scope), [agent, scope]);
};
