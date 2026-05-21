import { useRef } from 'react';

/**
 * Returns a stable array reference that updates only when contents differ by
 * reference identity (shallow-compare, order-sensitive). Useful as a memoization
 * key for arrays that may be rebuilt inline each render but typically contain
 * the same elements.
 */
export function useStableArray<T>(arr: T[]): T[] {
  const ref = useRef<T[]>(arr);
  const same = arr.length === ref.current.length && arr.every((item, i) => item === ref.current[i]);
  if (!same) ref.current = arr;
  return ref.current;
}
