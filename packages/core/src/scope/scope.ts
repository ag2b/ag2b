import type { Tool } from '@/tool';

/**
 * How a scope's resolved context is placed in the outgoing LLM request.
 * Set per-scope via {@link ScopeConfig.injection}; defaults to `'system'`.
 *
 * - `'system'` — context appended to the base system prompt. Compose, not
 *   replace. Cache-friendly when the underlying data is stable across iterations.
 * - `'user'` — context appended to the outgoing user message for this request
 *   only. History keeps the original user text — chat UIs render the typed
 *   bubble unchanged. Use for volatile data that would otherwise invalidate a
 *   cached system prefix on every change.
 */
export type ContextInjectionStrategy = 'system' | 'user';

/** Configuration for creating a {@link Scope}.*/
export type ScopeConfig = {
  /** Unique scope name. */
  name: string;
  /**
   * Human-readable section header rendered in the prompt.
   * Defaults to `name` when omitted.
   */
  label?: string;
  /** Tools contributed by this scope. */
  tools?: Tool[];
  /** Returning the scope's context payload.  */
  context?: () => unknown;
  /** How a scope's resolved context is placed in the outgoing LLM request. */
  injection?: ContextInjectionStrategy;
  /** Determines scope availability for LLM. */
  enabled?: () => boolean;
};

export type ScopeContext = {
  label: string;
  injection: ContextInjectionStrategy;
  /**
   * Raw value returned by the scope's `context` resolver. Serialization to
   * the wire happens at the provider boundary (string passes through;
   * non-string values are JSON-stringified).
   */
  content: unknown;
};

export class Scope implements ScopeConfig {
  readonly #name: string;
  readonly #label?: string;
  readonly #tools: Tool[];
  readonly #context?: () => unknown;
  readonly #injection: ContextInjectionStrategy;
  readonly #enabled?: () => boolean;

  constructor({ name, label, tools, context, injection, enabled }: ScopeConfig) {
    this.#name = name;
    this.#label = label;
    this.#tools = tools ?? [];
    this.#context = context;
    this.#injection = injection ?? 'system';
    this.#enabled = enabled;
  }

  get name() {
    return this.#name;
  }

  get label() {
    return this.#label ?? this.#name;
  }

  get tools() {
    return this.#tools;
  }

  get context() {
    return this.#context;
  }

  get enabled() {
    return this.#enabled;
  }

  get injection() {
    return this.#injection;
  }

  /**
   * Resolves the current availability of the scope.
   * Re-evaluated on every call.
   */
  isEnabled(): boolean {
    if (!this.#enabled) return true;

    try {
      return this.#enabled();
    } catch {
      return false;
    }
  }

  /**
   * Tools that should be exposed to the LLM. Empty if the scope is
   * disabled; otherwise filtered by each tool's own `isEnabled()`.
   */
  getEnabledTools(): Tool[] {
    if (this.isEnabled()) {
      return this.#tools.filter((tool) => tool.isEnabled());
    }

    return [];
  }

  /**
   * Resolves the scope's context to a raw value. Serialization happens at the
   * provider boundary. Returns `undefined` if the scope is disabled, no
   * `context` resolver was provided, or the resolver throws.
   */
  getContext(): ScopeContext | undefined {
    if (this.#context && this.isEnabled()) {
      try {
        return {
          label: this.label,
          injection: this.#injection,
          content: this.#context(),
        };
      } catch {
        return undefined;
      }
    }

    return undefined;
  }
}
