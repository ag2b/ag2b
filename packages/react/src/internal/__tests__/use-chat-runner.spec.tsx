import { act, renderHook } from '@testing-library/react';

import { useChatRunner } from '../use-chat-runner';

const flushMicrotasks = () => act(() => Promise.resolve());

describe('useChatRunner', () => {
  it('resolves with the run value and toggles isRunning', async () => {
    const { result } = renderHook(() => useChatRunner<number>());

    expect(result.current.isRunning).toBe(false);

    let resolve!: (value: number) => void;
    const pending = new Promise<number>((r) => {
      resolve = r;
    });

    let started: Promise<number | undefined>;
    act(() => {
      started = result.current.start(() => pending);
    });
    await flushMicrotasks();
    expect(result.current.isRunning).toBe(true);

    act(() => resolve(42));
    await act(async () => {
      await expect(started).resolves.toBe(42);
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('records non-abort errors in error state', async () => {
    const { result } = renderHook(() => useChatRunner<number>());
    const boom = new Error('boom');

    let started: Promise<number | undefined>;
    act(() => {
      started = result.current.start(() => Promise.reject(boom));
    });
    await act(async () => {
      await expect(started).resolves.toBeUndefined();
    });

    expect(result.current.error).toBe(boom);
    expect(result.current.isRunning).toBe(false);
  });

  it('aborts the previous run when start is called again', async () => {
    const { result } = renderHook(() => useChatRunner<string>());

    let firstSignal: AbortSignal | undefined;
    let firstStarted: Promise<string | undefined>;
    act(() => {
      firstStarted = result.current.start((signal) => {
        firstSignal = signal;
        return new Promise<string>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason as Error));
        });
      });
    });
    await flushMicrotasks();
    expect(firstSignal?.aborted).toBe(false);

    let secondStarted: Promise<string | undefined>;
    act(() => {
      secondStarted = result.current.start(() => Promise.resolve('second'));
    });

    await act(async () => {
      await expect(firstStarted).resolves.toBeUndefined();
      await expect(secondStarted).resolves.toBe('second');
    });

    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('abort() cancels the in-flight run without setting error', async () => {
    const { result } = renderHook(() => useChatRunner<string>());

    let signal: AbortSignal | undefined;
    let started: Promise<string | undefined>;
    act(() => {
      started = result.current.start((s) => {
        signal = s;
        return new Promise<string>((_, reject) => {
          s.addEventListener('abort', () => reject(s.reason as Error));
        });
      });
    });
    await flushMicrotasks();

    act(() => result.current.abort());
    await act(async () => {
      await expect(started).resolves.toBeUndefined();
    });

    expect(signal?.aborted).toBe(true);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('aborts in-flight run on unmount', async () => {
    const { result, unmount } = renderHook(() => useChatRunner<string>());

    let signal: AbortSignal | undefined;
    act(() => {
      void result.current.start((s) => {
        signal = s;
        return new Promise<string>((_, reject) => {
          s.addEventListener('abort', () => reject(s.reason as Error));
        });
      });
    });
    await flushMicrotasks();

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('discards a run that resolves after the signal was aborted', async () => {
    const { result } = renderHook(() => useChatRunner<string>());

    let resolveLate!: (v: string) => void;
    const latePromise = new Promise<string>((r) => {
      resolveLate = r;
    });

    let started: Promise<string | undefined>;
    act(() => {
      // Run ignores the abort signal and resolves on its own.
      started = result.current.start(() => latePromise);
    });
    await flushMicrotasks();

    act(() => result.current.abort());
    resolveLate('late'); // resolves after abort — runner must check signal.aborted

    await act(async () => {
      await expect(started).resolves.toBeUndefined();
    });
  });

  it('start() called after unmount resolves cleanly without setting state', async () => {
    const { result, unmount } = renderHook(() => useChatRunner<string>());
    const startFn = result.current.start;

    unmount();

    // After unmount, mountedRef is false. start() must skip setError/setIsRunning
    // on entry, but the run still executes and the promise still resolves.
    let resolved: string | undefined;
    await act(async () => {
      resolved = await startFn(() => Promise.resolve('value'));
    });
    expect(resolved).toBe('value');
  });

  it('start() called after unmount with a rejecting run resolves to undefined', async () => {
    const { result, unmount } = renderHook(() => useChatRunner<string>());
    const startFn = result.current.start;

    unmount();

    // mountedRef is false; non-abort error → catch block skips setError, returns undefined.
    let resolved: string | undefined;
    await act(async () => {
      resolved = await startFn(() => Promise.reject(new Error('boom')));
    });
    expect(resolved).toBeUndefined();
  });

  it('abort() called after unmount is a no-op', () => {
    const { result, unmount } = renderHook(() => useChatRunner<string>());
    const abortFn = result.current.abort;

    unmount();

    expect(() => act(() => abortFn())).not.toThrow();
  });

  it('abort() while idle is a no-op', () => {
    const { result } = renderHook(() => useChatRunner<string>());

    expect(() => act(() => result.current.abort())).not.toThrow();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBeUndefined();
  });
});
