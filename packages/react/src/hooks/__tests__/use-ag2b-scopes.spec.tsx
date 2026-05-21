import type { ScopeConfig } from '@ag2b/core';
import { Scope } from '@ag2b/core';
import { act, renderHook } from '@testing-library/react';

import { makeAgent, wrapper } from '../../__tests__/fixtures';
import { useAg2bScope } from '../use-ag2b-scope';
import { useAg2bScopes } from '../use-ag2b-scopes';

const cartConfig: ScopeConfig = { name: 'cart' };

describe('useAg2bScopes', () => {
  it('returns an empty array when no scopes are registered', () => {
    const agent = makeAgent();
    const { result } = renderHook(() => useAg2bScopes(), { wrapper: wrapper(agent) });
    expect(result.current).toEqual([]);
  });

  it('returns scopes registered before the hook mounted', () => {
    const agent = makeAgent();
    agent.scopes.register(new Scope({ name: 'cart' }));

    const { result } = renderHook(() => useAg2bScopes(), { wrapper: wrapper(agent) });
    expect(result.current.map((s) => s.name)).toEqual(['cart']);
  });

  it('re-renders when a scope is registered after mount', () => {
    const agent = makeAgent();
    const { result } = renderHook(() => useAg2bScopes(), { wrapper: wrapper(agent) });
    expect(result.current).toEqual([]);

    act(() => {
      agent.scopes.register(new Scope({ name: 'cart' }));
    });
    expect(result.current.map((s) => s.name)).toEqual(['cart']);
  });

  it('re-renders when a scope is unregistered', () => {
    const agent = makeAgent();
    const scope = new Scope({ name: 'cart' });
    agent.scopes.register(scope);

    const { result } = renderHook(() => useAg2bScopes(), { wrapper: wrapper(agent) });
    expect(result.current).toHaveLength(1);

    act(() => {
      agent.scopes.unregister('cart');
    });
    expect(result.current).toEqual([]);
  });

  it('returns a stable reference across no-op re-renders', () => {
    const agent = makeAgent();
    agent.scopes.register(new Scope({ name: 'cart' }));

    const { result, rerender } = renderHook(() => useAg2bScopes(), { wrapper: wrapper(agent) });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('integrates with useAg2bScope: registers a scope from a sibling and observes it', () => {
    const agent = makeAgent();

    // A wrapper hook that calls TWO hooks: one registers a scope, one reads scopes.
    // useAg2bScopes should reflect the registration after useAg2bScope's useEffect commits.
    const useBoth = () => {
      useAg2bScope(cartConfig);
      return useAg2bScopes();
    };

    const { result } = renderHook(() => useBoth(), { wrapper: wrapper(agent) });
    expect(result.current.map((s) => s.name)).toEqual(['cart']);
  });
});
