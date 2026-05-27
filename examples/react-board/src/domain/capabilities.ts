import { create } from 'zustand';

// User-controlled grant/revoke of what the assistant may do. Scope and tool
// `enabled` predicates read this, so flipping a switch removes a scope's tools +
// context (scope) or a single tool, live, on the next agent iteration.
// Absent key = enabled (opt-out model).
type CapabilitiesState = {
  scopeEnabled: Record<string, boolean>;
  toolEnabled: Record<string, boolean>;
  toggleScope: (name: string) => void;
  toggleTool: (name: string) => void;
};

export const useCapabilitiesStore = create<CapabilitiesState>((set) => ({
  scopeEnabled: {},
  toolEnabled: {},
  toggleScope: (name) =>
    set((s) => ({
      scopeEnabled: { ...s.scopeEnabled, [name]: s.scopeEnabled[name] === false },
    })),
  toggleTool: (name) =>
    set((s) => ({
      toolEnabled: { ...s.toolEnabled, [name]: s.toolEnabled[name] === false },
    })),
}));

export function isScopeEnabled(name: string): boolean {
  return useCapabilitiesStore.getState().scopeEnabled[name] !== false;
}

export function isToolEnabled(name: string): boolean {
  return useCapabilitiesStore.getState().toolEnabled[name] !== false;
}
