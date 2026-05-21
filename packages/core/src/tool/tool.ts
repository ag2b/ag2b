import z from 'zod/v4';

import { Ag2bError, Ag2bToolValidationError } from '@/errors';

/**
 * Top-level JSON Schema keys passed through to the LLM. Anything not on this list
 * (e.g. Zod's `~standard` brand, JSON Schema `$schema` dialect URL, or future internal
 * fields from upstream libraries) is stripped. Nested property definitions are preserved
 * as-is — this allowlist applies only to the root object describing the tool parameters.
 */
const TOP_LEVEL_SCHEMA_KEYS = [
  'type',
  'properties',
  'required',
  'additionalProperties',
  'description',
  '$defs',
] as const;

/** A tool handler may return a value synchronously or as a Promise. */
export type ToolHandlerReturn<T> = T | Promise<T>;

/** Configuration for creating a {@link Tool}.*/
export type ToolConfig<Parameters extends z.ZodObject, Return> = {
  /** Unique tool name. Must match `/^[a-zA-Z0-9_-]+$/`. */
  name: string;
  /** Human-readable description sent to the LLM to explain when to use this tool. */
  description: string;
  /** Zod schema for the tool's input parameters. Converted to JSON Schema for the LLM. */
  parameters: Parameters;
  /** Function invoked when the LLM calls this tool. */
  handler: (params: z.infer<Parameters>) => ToolHandlerReturn<Return>;
  /** Determines tool availability for LLM. */
  enabled?: () => boolean;
};

/**
 * A tool that can be called by an LLM agent.
 * Wraps a Zod schema for parameter validation and a handler function for execution.
 *
 * @example
 * ```typescript
 * const addToCart = new Tool({
 *   name: 'addToCart',
 *   description: 'Add a product to the shopping cart',
 *   parameters: z.object({
 *     productId: z.string().describe('The product ID'),
 *     quantity: z.number().int().positive().describe('How many to add'),
 *   }),
 *   handler: ({ productId, quantity }) => cart.add(productId, quantity),
 *   enabled: () => user.role === 'admin',
 * });
 * ```
 */
export class Tool<
  Parameters extends z.ZodObject = z.ZodObject,
  Return = unknown,
> implements ToolConfig<Parameters, Return> {
  readonly #name: string;
  readonly #description: string;
  readonly #parameters: Parameters;
  readonly #handler: (params: z.infer<Parameters>) => ToolHandlerReturn<Return>;
  readonly #enabled?: () => boolean;

  constructor({ name, description, parameters, handler, enabled }: ToolConfig<Parameters, Return>) {
    this.#name = this.parseName(name);
    this.#description = description;
    this.#parameters = parameters;
    this.#handler = handler;
    this.#enabled = enabled;
  }

  get name() {
    return this.#name;
  }

  get description() {
    return this.#description;
  }

  get parameters() {
    return this.#parameters;
  }

  get handler() {
    return this.#handler;
  }

  get enabled() {
    return this.#enabled;
  }

  /** Returns the Zod schema converted to JSON Schema for the LLM.  */
  get schema(): Record<string, unknown> {
    const raw = z.toJSONSchema(this.#parameters) as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const key of TOP_LEVEL_SCHEMA_KEYS) {
      if (key in raw) out[key] = raw[key];
    }

    return out;
  }

  /**
   * Validate raw arguments against the Zod schema and execute the handler.
   * @param args - Raw arguments from the LLM. Parsed and validated before the handler runs.
   * @throws Ag2bToolValidationError If arguments fail validation.
   * @throws Custom handler error
   */
  execute(args?: z.infer<Parameters>): ToolHandlerReturn<Return> {
    let payload: z.infer<Parameters>;

    try {
      payload = this.#parameters.parse(args);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Ag2bToolValidationError(this.#name, error.issues);
      }

      throw error;
    }

    return this.#handler(payload);
  }

  /**
   * Resolves the current availability of the tool.
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

  private parseName(name: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Ag2bError(`Invalid tool name "${name}". Must match /^[a-zA-Z0-9_-]+$/`);
    }

    return name;
  }
}
