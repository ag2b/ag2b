import '@/types';

import type { Ag2bPlugin, Ag2bPluginCleanup, Scope, Tool } from '@ag2b/core';

export function webmcp(): Ag2bPlugin {
  return (agent) => {
    if (typeof navigator === 'undefined' || !navigator.modelContext) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const noop: Ag2bPluginCleanup = () => {};
      return noop;
    }

    const ctx = navigator.modelContext;
    const controllers = new Map<Scope, AbortController[]>();

    const registerScope = (scope: Scope): void => {
      const list: AbortController[] = [];
      controllers.set(scope, list);
      for (const tool of scope.tools) {
        const controller = new AbortController();
        ctx.registerTool(buildWebmcpTool(scope, tool), { signal: controller.signal });
        list.push(controller);
      }
    };

    for (const scope of agent.scopes.getSnapshot()) {
      registerScope(scope);
    }

    const offRegister = agent.addHook('onScopeRegister', ({ scope }) => {
      registerScope(scope);
    });

    const offUnregister = agent.addHook('onScopeUnregister', ({ scope }) => {
      const list = controllers.get(scope);
      if (!list) return;
      for (const c of list) c.abort();
      controllers.delete(scope);
    });

    const cleanup: Ag2bPluginCleanup = () => {
      offRegister();
      offUnregister();
      for (const list of controllers.values()) {
        for (const c of list) c.abort();
      }
      controllers.clear();
    };

    return cleanup;
  };
}

function buildWebmcpTool(scope: Scope, tool: Tool): ModelContextTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.schema,
    execute: async (input) => {
      if (!tool.isEnabled() || !scope.isEnabled()) {
        throw new Error(`Tool "${tool.name}" is disabled`);
      }
      return await tool.execute(input as Record<string, unknown>);
    },
  };
}
