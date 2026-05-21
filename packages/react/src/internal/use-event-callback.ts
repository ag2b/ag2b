import { useCallback, useRef } from 'react';

/**
 * Returns a stable function reference whose call always invokes the latest
 * `fn` closure. Use when passing a callback into long-lived registrations
 * (effect deps, agent hooks, scope predicates) without re-registering on
 * every render.
 *
 * Updates the ref **during render** so consumers reading the stable callback
 * during a sibling component's render observe the current closure (avoids
 * a one-render staleness window that the layout-effect variant has).
 *
 * Mirrors the pattern behind React's experimental `useEffectEvent`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEventCallback<F extends (...args: any[]) => any>(fn: F): F {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument
    ((...args: any[]) => ref.current(...args)) as F,
    []
  );
}
