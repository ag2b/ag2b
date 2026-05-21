import type z from 'zod/v4';

/** Base error class for all ag2b errors. */
export class Ag2bError extends Error {
  override name = 'Ag2bError';
}

/** Thrown when the LLM provider returns a non-OK HTTP response. */
export class Ag2bProviderRequestError extends Ag2bError {
  override name = 'Ag2bProviderRequestError';

  constructor(
    message: string,
    /** HTTP status code from the provider response. */
    public readonly status?: number,
    /** Raw response body, if available. */
    public readonly body?: unknown
  ) {
    super(message);
  }
}

/**
 * Thrown when the provider responded successfully at the HTTP layer but the
 * payload is unusable — empty body, missing fields, malformed tool-call JSON,
 * or an explicit error event mid-stream.
 */
export class Ag2bProviderResponseError extends Ag2bError {
  override name = 'Ag2bProviderResponseError';

  constructor(
    message: string,
    /** Raw payload that caused the failure (full response, offending JSON string, mid-stream error event, …). */
    public readonly body?: unknown
  ) {
    super(message);
  }
}

/** Thrown when the agent loop exceeds {@link AgentConfig.maxIterations}. */
export class Ag2bMaxIterationsError extends Ag2bError {
  override name = 'Ag2bMaxIterationsError';

  constructor(iterations: number) {
    super(`Agent loop exceeded ${iterations} iterations without a final response.`);
  }
}

/**
 * Thrown by {@link Tool.execute} when the LLM-provided arguments fail Zod
 * validation. `issues` carries the original Zod issue list so it can be
 * surfaced back to the LLM as structured tool-failure context.
 */
export class Ag2bToolValidationError extends Ag2bError {
  override name = 'Ag2bToolValidationError';

  constructor(
    public readonly tool: string,
    public readonly issues: z.core.$ZodIssue[]
  ) {
    super(`Invalid arguments passed for tool "${tool}"`);
  }
}

export class Ag2bUnknownToolError extends Ag2bError {
  override name = 'Ag2bUnknownToolError';

  constructor(tool: string) {
    super(`Unknown tool "${tool}"`);
  }
}
export class Ag2bDisabledToolError extends Ag2bError {
  override name = 'Ag2bDisabledToolError';

  constructor(tool: string) {
    super(`Tool "${tool}" is currently unavailable`);
  }
}

/**
 * Coerce a thrown value into something safe to feed through `JSON.stringify`.
 *
 * `Error` instances are unwrapped to a plain object: `name` and `message` are
 * extracted explicitly (they're non-enumerable on `Error.prototype` and would
 * otherwise vanish through `JSON.stringify`), and any enumerable instance
 * properties from a subclass — e.g. {@link Ag2bToolValidationError},
 * {@link Ag2bProviderRequestError} — are preserved via spread.
 *
 * Non-Error values (objects, primitives, null, undefined) pass through
 * unchanged, on the assumption the caller knew what shape they were throwing.
 */
export const serializeError = (value: unknown): unknown => {
  if (value instanceof Error) {
    return { ...value, name: value.name, message: value.message };
  }
  return value;
};
