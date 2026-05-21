import { renderHook } from '@testing-library/react';

import { useEventCallback } from '../use-event-callback';

describe('useEventCallback', () => {
  it('returns a stable function identity across re-renders', () => {
    const { result, rerender } = renderHook(
      ({ fn }: { fn: () => number }) => useEventCallback(fn),
      { initialProps: { fn: () => 1 } }
    );
    const first = result.current;
    rerender({ fn: () => 2 });
    expect(result.current).toBe(first);
  });

  it('always invokes the latest closure when called', () => {
    const { result, rerender } = renderHook(
      ({ fn }: { fn: () => string }) => useEventCallback(fn),
      { initialProps: { fn: () => 'a' } }
    );
    expect(result.current()).toBe('a');
    rerender({ fn: () => 'b' });
    expect(result.current()).toBe('b');
  });

  it('forwards arguments to the wrapped closure', () => {
    const { result } = renderHook(() => useEventCallback((a: number, b: number) => a + b));
    expect(result.current(2, 3)).toBe(5);
  });

  it('passes through async return values', () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const { result } = renderHook(() => useEventCallback(async (x: number) => x * 2));
    return expect(result.current(4)).resolves.toBe(8);
  });

  it('returns the latest closure when read during render', () => {
    // Reproduces the off-by-one staleness:
    // a sibling reader that calls the stable callback during its own render
    // should observe the latest closure value, not the previous render's.
    const { result, rerender } = renderHook(
      ({ fn }: { fn: () => string }) => {
        const stable = useEventCallback(fn);
        // Simulate a sibling reading during render.
        return { stable, observed: stable() };
      },
      { initialProps: { fn: () => 'first' } }
    );
    expect(result.current.observed).toBe('first');

    rerender({ fn: () => 'second' });
    // With useLayoutEffect, this would be 'first' (off-by-one).
    // With latest-ref, it's 'second'.
    expect(result.current.observed).toBe('second');
  });
});
