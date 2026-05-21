import type { ToolConfig } from '@ag2b/core';
import { Tool } from '@ag2b/core';
import { useMemo } from 'react';
import type z from 'zod/v4';

import { useEventCallback } from '@/internal';

const noopTrue = (): boolean => true;

/**
 * Build a {@link Tool}. `enabled` and `handler` are auto-pinned — inline
 * arrows are safe to read reactive state.
 *
 * Stable per mount. Pass `deps` when `description` or `parameters` read
 * reactive values (e.g. a Zod schema with `.max(maxLen)`).
 *
 * Pair with {@link useAg2bScope} to register the tool.
 *
 * @example
 * ```tsx
 * const tool = useAg2bTool({
 *   name: 'createPost',
 *   description: `Create a post with up to ${maxLen} chars.`,
 *   parameters: z.object({ content: z.string().max(maxLen) }),
 *   handler: createPost,
 * }, [maxLen]);
 * ```
 */
export const useAg2bTool = <P extends z.ZodObject = z.ZodObject, R = unknown>(
  config: ToolConfig<P, R>,
  deps: unknown[] = []
): Tool<P, R> => {
  const enabledStable = useEventCallback(config.enabled ?? noopTrue);
  const handlerStable = useEventCallback(config.handler);
  const hasEnabled = config.enabled !== undefined;

  return useMemo(
    () =>
      new Tool<P, R>({
        name: config.name,
        description: config.description,
        parameters: config.parameters,
        handler: handlerStable,
        enabled: hasEnabled ? enabledStable : undefined,
      }),
    [config.name, enabledStable, handlerStable, ...deps]
  );
};
