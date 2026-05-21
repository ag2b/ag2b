import { renderHook } from '@testing-library/react';

import { makeAgent, wrapper } from '../../__tests__/fixtures';
import { useAg2bAgent } from '../use-ag2b-agent';

describe('useAg2bAgent', () => {
  it('returns the agent from context', () => {
    const agent = makeAgent();
    const { result } = renderHook(() => useAg2bAgent(), { wrapper: wrapper(agent) });
    expect(result.current).toBe(agent);
  });

  it('returns a stable identity across re-renders', () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(() => useAg2bAgent(), { wrapper: wrapper(agent) });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('throws when used outside a Provider', () => {
    expect(() => renderHook(() => useAg2bAgent())).toThrow(/Provider/);
  });
});
