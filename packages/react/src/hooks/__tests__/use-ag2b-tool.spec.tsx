import { Scope, Tool } from '@ag2b/core';
import { act, renderHook } from '@testing-library/react';
import { z } from 'zod/v4';

import { makeAgent, wrapper } from '../../__tests__/fixtures';
import { useAg2bScope } from '../use-ag2b-scope';
import { useAg2bTool } from '../use-ag2b-tool';

describe('useAg2bTool', () => {
  it('returns a stable Tool instance across re-renders', () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(
      () =>
        useAg2bTool({
          name: 'noop',
          description: 'no-op',
          parameters: z.object({}),
          handler: () => null,
        }),
      { wrapper: wrapper(agent) }
    );

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first).toBeInstanceOf(Tool);
    expect(first.name).toBe('noop');
  });

  it('returns the latest enabled() result after state changes (auto-pin)', () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(
      ({ count }: { count: number }) =>
        useAg2bTool({
          name: 'gated',
          description: 'gated tool',
          parameters: z.object({}),
          enabled: () => count > 0,
          handler: () => null,
        }),
      { wrapper: wrapper(agent), initialProps: { count: 0 } }
    );

    expect(result.current.isEnabled()).toBe(false);

    rerender({ count: 5 });
    expect(result.current.isEnabled()).toBe(true);
  });

  it('invokes the latest handler closure after state changes', async () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(
      ({ multiplier }: { multiplier: number }) =>
        useAg2bTool({
          name: 'multiply',
          description: 'multiply',
          parameters: z.object({ x: z.number() }),
          handler: ({ x }: { x: number }) => x * multiplier,
        }),
      { wrapper: wrapper(agent), initialProps: { multiplier: 2 } }
    );

    expect(await result.current.execute({ x: 5 })).toBe(10);

    rerender({ multiplier: 3 });
    expect(await result.current.execute({ x: 5 })).toBe(15);
  });

  it('parses arguments via the configured Zod schema', async () => {
    const agent = makeAgent();
    const { result } = renderHook(
      () =>
        useAg2bTool({
          name: 'add',
          description: 'add',
          parameters: z.object({ a: z.number(), b: z.number() }),
          handler: ({ a, b }: { a: number; b: number }) => a + b,
        }),
      { wrapper: wrapper(agent) }
    );

    expect(await result.current.execute({ a: 2, b: 3 })).toBe(5);
  });

  it('is stable when enabled toggles defined ↔ undefined without deps', () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(
      ({ withEnabled }: { withEnabled: boolean }) =>
        useAg2bTool({
          name: 'toggle',
          description: 'toggle',
          parameters: z.object({}),
          enabled: withEnabled ? () => true : undefined,
          handler: () => null,
        }),
      { wrapper: wrapper(agent), initialProps: { withEnabled: true } }
    );

    const first = result.current;
    rerender({ withEnabled: false });
    expect(result.current).toBe(first);
  });

  it('re-creates the Tool when name changes', () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(
      ({ name }: { name: string }) =>
        useAg2bTool({
          name,
          description: 'd',
          parameters: z.object({}),
          handler: () => null,
        }),
      { wrapper: wrapper(agent), initialProps: { name: 'first' } }
    );

    const first = result.current;
    expect(first.name).toBe('first');

    rerender({ name: 'second' });
    expect(result.current).not.toBe(first);
    expect(result.current.name).toBe('second');
  });

  it('integrates with useAg2bScope: registered Tool is findable in the registry', () => {
    const agent = makeAgent();

    const useBoth = () => {
      const tool = useAg2bTool({
        name: 'cart-checkout',
        description: 'submit',
        parameters: z.object({}),
        handler: () => null,
      });
      useAg2bScope({ name: 'cart', tools: [tool] });
    };

    renderHook(() => useBoth(), { wrapper: wrapper(agent) });

    const found = agent.scopes.findTool('cart-checkout');
    expect(found).toBeDefined();
    expect(found?.tool.name).toBe('cart-checkout');
    expect(found?.scope).toBeInstanceOf(Scope);
    expect(found?.scope.name).toBe('cart');
  });

  it('integrates with useAg2bScope: state-driven enabled is fresh when read via the registry', () => {
    const agent = makeAgent();

    const useBoth = ({ count }: { count: number }) => {
      const tool = useAg2bTool({
        name: 'gated',
        description: 'gated',
        parameters: z.object({}),
        enabled: () => count > 0,
        handler: () => null,
      });
      useAg2bScope({ name: 'gates', tools: [tool] });
    };

    const { rerender } = renderHook(useBoth, {
      wrapper: wrapper(agent),
      initialProps: { count: 0 },
    });

    expect(agent.scopes.findTool('gated')?.enabled).toBe(false);

    act(() => rerender({ count: 1 }));
    expect(agent.scopes.findTool('gated')?.enabled).toBe(true);
  });

  it('falls back to always-enabled when enabled toggles from a fn to undefined', () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useAg2bTool({
          name: 't',
          description: 't',
          parameters: z.object({}),
          enabled: on ? () => false : undefined,
          handler: () => null,
        }),
      { wrapper: wrapper(agent), initialProps: { on: true } }
    );

    expect(result.current.isEnabled()).toBe(false);

    rerender({ on: false });
    expect(result.current.isEnabled()).toBe(true);
  });

  it('re-creates the Tool when consumer deps change', () => {
    const agent = makeAgent();
    const { result, rerender } = renderHook(
      ({ max }: { max: number }) =>
        useAg2bTool(
          {
            name: 'bounded',
            description: `max ${max}`,
            parameters: z.object({ x: z.number().max(max) }),
            handler: () => null,
          },
          [max]
        ),
      { wrapper: wrapper(agent), initialProps: { max: 10 } }
    );

    const first = result.current;
    rerender({ max: 20 });
    expect(result.current).not.toBe(first);
  });
});
