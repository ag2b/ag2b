import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

export type ChatRunnerReturn<T> = {
  /**
   * Start a new run. Aborts any prior in-flight run; the prior run's promise
   * resolves to `undefined`. Returns the resolved value, or `undefined` if the
   * run was aborted/superseded/threw.
   */
  start: (run: (signal: AbortSignal) => Promise<T>) => Promise<T | undefined>;
  /** Abort the current in-flight run. No-op if idle. Clean cancel — does not set `error`. */
  abort: () => void;
  /** True between `start()` entry and resolution/rejection/abort. */
  isRunning: boolean;
  /** Last non-abort error from a run, or `undefined`. Cleared on each `start()`. */
  error: unknown;
};

/**
 * Shared abort/error/loading state machine for chat hooks.
 *
 * Owns: a single live `AbortController`, mounted-ref guard, abort-on-unmount,
 * and error normalization (`AbortError` is suppressed).
 */
export function useChatRunner<T>(): ChatRunnerReturn<T> {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  const controllerRef = useRef<AbortController | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = undefined;
    };
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    if (mountedRef.current) setIsRunning(false);
  }, []);

  const start = useCallback(
    async (run: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (mountedRef.current) {
        setError(undefined);
        setIsRunning(true);
      }

      try {
        const result = await run(controller.signal);
        if (controller.signal.aborted) return undefined;
        return result;
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) return undefined;
        if (mountedRef.current) setError(err);
        return undefined;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = undefined;
          if (mountedRef.current) setIsRunning(false);
        }
      }
    },
    []
  );

  return useMemo(() => ({ start, abort, isRunning, error }), [start, abort, isRunning, error]);
}
