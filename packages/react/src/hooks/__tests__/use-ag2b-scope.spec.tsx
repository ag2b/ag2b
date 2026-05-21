import type { ScopeConfig } from '@ag2b/core';
import { Tool } from '@ag2b/core';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import z from 'zod/v4';

import { makeAgent, wrapper } from '../../__tests__/fixtures';
import { useAg2bScope } from '../use-ag2b-scope';
import { useAg2bTool } from '../use-ag2b-tool';

const sumTool = new Tool({
  name: 'sum',
  description: 'Sum two numbers',
  parameters: z.object({ a: z.number(), b: z.number() }),
  handler: ({ a, b }) => a + b,
});

const otherTool = new Tool({
  name: 'other',
  description: 'noop',
  parameters: z.object({}),
  handler: () => null,
});

describe('useAg2bScope', () => {
  it('registers the scope on mount and unregisters on unmount', () => {
    const agent = makeAgent();
    const config: ScopeConfig = { name: 'cart', tools: [sumTool] };

    const { unmount } = renderHook(() => useAg2bScope(config), { wrapper: wrapper(agent) });
    expect(agent.scopes.getSnapshot().map((s) => s.name)).toContain('cart');

    unmount();
    expect(agent.scopes.getSnapshot().map((s) => s.name)).not.toContain('cart');
  });

  it('does not re-register when only the enabled closure body changes', () => {
    const agent = makeAgent();
    const spy = vi.spyOn(agent.scopes, 'register');

    const { rerender } = renderHook(
      ({ flag }) =>
        useAg2bScope({
          name: 'cart',
          tools: [sumTool],
          enabled: () => flag,
        }),
      { wrapper: wrapper(agent), initialProps: { flag: true } }
    );

    expect(spy).toHaveBeenCalledTimes(1);

    rerender({ flag: false });
    rerender({ flag: true });
    rerender({ flag: false });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('enabled() reads the latest closure', () => {
    const agent = makeAgent();
    let flag = true;

    const { rerender } = renderHook(
      ({ value }) =>
        useAg2bScope({
          name: 'cart',
          tools: [sumTool],
          enabled: () => value,
        }),
      { wrapper: wrapper(agent), initialProps: { value: flag } }
    );

    expect(agent.scopes.findTool('sum')?.enabled).toBe(true);

    flag = false;
    rerender({ value: flag });
    expect(agent.scopes.findTool('sum')?.enabled).toBe(false);
  });

  it('re-registers when the scope name changes', () => {
    const agent = makeAgent();
    const spy = vi.spyOn(agent.scopes, 'register');

    const { rerender } = renderHook(({ name }) => useAg2bScope({ name, tools: [sumTool] }), {
      wrapper: wrapper(agent),
      initialProps: { name: 'cart' },
    });
    expect(spy).toHaveBeenCalledTimes(1);

    rerender({ name: 'admin' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(agent.scopes.getSnapshot().map((s) => s.name)).toEqual(['admin']);
  });

  it('re-registers when the set of tool names changes', () => {
    const agent = makeAgent();
    const spy = vi.spyOn(agent.scopes, 'register');

    const { rerender } = renderHook(({ tools }) => useAg2bScope({ name: 'cart', tools }), {
      wrapper: wrapper(agent),
      initialProps: { tools: [sumTool] as ScopeConfig['tools'] },
    });
    expect(spy).toHaveBeenCalledTimes(1);

    rerender({ tools: [sumTool, otherTool] });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('plays well with React state in the consumer', () => {
    const agent = makeAgent();

    const useTestSetup = () => {
      const [count, setCount] = useState(0);
      useAg2bScope({
        name: 'cart',
        tools: [sumTool],
        enabled: () => count < 3,
      });
      return { count, setCount };
    };

    const { result } = renderHook(useTestSetup, { wrapper: wrapper(agent) });

    expect(agent.scopes.findTool('sum')?.enabled).toBe(true);

    act(() => result.current.setCount(5));
    expect(agent.scopes.findTool('sum')?.enabled).toBe(false);
  });

  it('passes label and injection through to the registered scope', () => {
    const agent = makeAgent();
    renderHook(
      () =>
        useAg2bScope({ name: 'cart', label: 'Shopping Cart', injection: 'user', tools: [sumTool] }),
      { wrapper: wrapper(agent) }
    );

    const scope = agent.scopes.get('cart');
    expect(scope?.label).toBe('Shopping Cart');
    expect(scope?.injection).toBe('user');
  });

  it('exposes context() output via the scope registry', () => {
    const agent = makeAgent();
    renderHook(
      () => useAg2bScope({ name: 'cart', tools: [sumTool], context: () => ({ items: 3 }) }),
      { wrapper: wrapper(agent) }
    );

    const contexts = agent.scopes.getContexts();
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.content).toEqual({ items: 3 });
  });

  it('context() reads the latest closure', () => {
    const agent = makeAgent();
    let total = 10;

    const { rerender } = renderHook(
      ({ value }) =>
        useAg2bScope({ name: 'cart', tools: [sumTool], context: () => ({ total: value }) }),
      { wrapper: wrapper(agent), initialProps: { value: total } }
    );

    expect(agent.scopes.getContexts()[0]?.content).toEqual({ total: 10 });

    total = 42;
    rerender({ value: total });
    expect(agent.scopes.getContexts()[0]?.content).toEqual({ total: 42 });
  });

  it('handles a config without tools', () => {
    const agent = makeAgent();
    renderHook(() => useAg2bScope({ name: 'empty' }), { wrapper: wrapper(agent) });

    expect(agent.scopes.getSnapshot().map((s) => s.name)).toContain('empty');
    // Tool registry should not include any new tools, since the scope provided none.
    expect(agent.scopes.findTool('sum')).toBeUndefined();
  });

  it('re-registers when an inner Tool re-creates via its own deps', () => {
    const agent = makeAgent();
    const spy = vi.spyOn(agent.scopes, 'register');

    const useSetup = ({ max }: { max: number }) => {
      const tool = useAg2bTool(
        {
          name: 'bounded',
          description: `max ${max}`,
          parameters: z.object({ x: z.number().max(max) }),
          handler: () => null,
        },
        [max]
      );
      useAg2bScope({ name: 'auto-cascade', tools: [tool] });
    };

    const { rerender } = renderHook(useSetup, {
      wrapper: wrapper(agent),
      initialProps: { max: 10 },
    });
    expect(spy).toHaveBeenCalledTimes(1);

    rerender({ max: 20 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not re-register when the tools array re-builds with same refs', () => {
    const agent = makeAgent();
    const spy = vi.spyOn(agent.scopes, 'register');

    const { rerender } = renderHook(() => useAg2bScope({ name: 'inline', tools: [sumTool] }), {
      wrapper: wrapper(agent),
    });
    expect(spy).toHaveBeenCalledTimes(1);

    rerender();
    rerender();
    rerender();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('falls back to always-enabled and undefined-context when both toggle from fn to undefined', () => {
    const agent = makeAgent();
    const { rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useAg2bScope({
          name: 'fx',
          tools: [sumTool],
          enabled: on ? () => true : undefined,
          context: on ? () => ({ v: 1 }) : undefined,
        }),
      { wrapper: wrapper(agent), initialProps: { on: true } }
    );

    expect(agent.scopes.findTool('sum')?.enabled).toBe(true);
    expect(agent.scopes.getContexts()[0]?.content).toEqual({ v: 1 });

    rerender({ on: false });
    expect(agent.scopes.findTool('sum')?.enabled).toBe(true);
    expect(agent.scopes.getContexts()[0]?.content).toBeUndefined();
  });

  it('re-registers when consumer deps change', () => {
    const agent = makeAgent();
    const spy = vi.spyOn(agent.scopes, 'register');

    const { rerender } = renderHook(
      ({ key }: { key: number }) => useAg2bScope({ name: 'forced', tools: [sumTool] }, [key]),
      { wrapper: wrapper(agent), initialProps: { key: 0 } }
    );
    expect(spy).toHaveBeenCalledTimes(1);

    rerender({ key: 1 });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
