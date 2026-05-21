import { userMessage } from '@ag2b/core';
import { act, renderHook } from '@testing-library/react';

import { makeAgent, wrapper } from '../../__tests__/fixtures';
import { useAg2bHistory } from '../use-ag2b-history';

describe('useAg2bHistory', () => {
  it('returns an empty array initially', () => {
    const agent = makeAgent();
    const { result } = renderHook(() => useAg2bHistory(), { wrapper: wrapper(agent) });
    expect(result.current).toEqual([]);
  });

  it('re-renders consumers when history is pushed', () => {
    const agent = makeAgent();
    const { result } = renderHook(() => useAg2bHistory(), { wrapper: wrapper(agent) });
    expect(result.current).toEqual([]);

    act(() => agent.history.push(userMessage('hi')));
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual({ role: 'user', content: 'hi' });
  });

  it('re-renders consumers on history reset', () => {
    const agent = makeAgent();
    agent.history.push(userMessage('one'));
    agent.history.push(userMessage('two'));
    const { result } = renderHook(() => useAg2bHistory(), { wrapper: wrapper(agent) });
    expect(result.current).toHaveLength(2);

    act(() => agent.history.reset());
    expect(result.current).toEqual([]);
  });

  it('returns the same snapshot reference across no-op re-renders', () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(() => useAg2bHistory(), { wrapper: wrapper(agent) });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
