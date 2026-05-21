import { Ag2bError } from '@/errors';
import type { Tool } from '@/tool';

import type { Scope, ScopeContext } from './scope';

export type ToolIndex = {
  tool: Tool;
  scope: Scope;
};

export type ScopeRegistryConfig = {
  onRegister?: (scope: Scope) => void;
  onUnregister?: (scope: Scope) => void;
};

export class ScopeRegistry {
  readonly #scopes = new Map<string, Scope>();
  readonly #tools = new Map<string, ToolIndex>();
  readonly #onRegister?: (scope: Scope) => void;
  readonly #onUnregister?: (scope: Scope) => void;

  #snapshot: Scope[] = [];
  #listeners = new Set<() => void>();

  constructor({ onRegister, onUnregister }: ScopeRegistryConfig = {}) {
    this.#onRegister = onRegister;
    this.#onUnregister = onUnregister;
  }

  /**
   * Subscribe to register/unregister changes.
   * Arrow property — safe to pass as a bare reference.
   * @returns unsubscribe function
   */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /**
   * Returns an immutable snapshot of the currently registered scopes.
   * Same reference if the registry has not changed since last mutation.
   * Arrow property — safe to pass as a bare reference.
   */
  getSnapshot = (): Scope[] => this.#snapshot;

  register(scope: Scope): () => void {
    if (this.#scopes.has(scope.name)) {
      throw new Ag2bError(`Scope "${scope.name}" already registered`);
    }

    for (const tool of scope.tools) {
      const found = this.#tools.get(tool.name);
      if (found) {
        throw new Ag2bError(
          `Tool "${tool.name}" already registered in scope "${found.scope.name}"`
        );
      }
    }

    this.#scopes.set(scope.name, scope);
    for (const tool of scope.tools) {
      this.#tools.set(tool.name, { tool, scope });
    }

    this.#snapshot = Array.from(this.#scopes.values());
    this.#onRegister?.(scope);
    this.#notify();

    return () => this.unregister(scope.name);
  }

  unregister(name: string): void {
    const scope = this.#scopes.get(name);

    if (scope) {
      this.#scopes.delete(name);
      for (const tool of scope.tools) {
        this.#tools.delete(tool.name);
      }

      this.#snapshot = Array.from(this.#scopes.values());
      this.#onUnregister?.(scope);
      this.#notify();
    }
  }

  get(name: string): Scope | undefined {
    return this.#scopes.get(name);
  }

  findTool(name: string): (ToolIndex & { enabled: boolean }) | undefined {
    const found = this.#tools.get(name);

    if (!found) return undefined;

    return {
      ...found,
      enabled: found.scope.isEnabled() && found.tool.isEnabled(),
    };
  }

  getEnabledTools(): Tool[] {
    const tools = [];

    for (const scope of this.#scopes.values()) {
      tools.push(...scope.getEnabledTools());
    }

    return tools;
  }

  getContexts(): ScopeContext[] {
    const contexts = [];

    for (const scope of this.#scopes.values()) {
      const context = scope.getContext();
      if (context) {
        contexts.push(context);
      }
    }

    return contexts;
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener());
  }
}
