import z from 'zod/v4';

import { Tool } from '@/tool';

import { Scope } from '../scope';

const makeTool = (
  name: string,
  enabled?: () => boolean,
  handler: (a: { x: number }) => unknown = ({ x }) => x
) =>
  new Tool({
    name,
    description: `${name} tool`,
    parameters: z.object({ x: z.number() }),
    handler,
    enabled,
  });

describe('Scope', () => {
  describe('Scope::construction', () => {
    it('exposes name via getter', () => {
      const scope = new Scope({ name: 'cart', tools: [] });
      expect(scope.name).toBe('cart');
    });

    it('label defaults to name when omitted', () => {
      const scope = new Scope({ name: 'cart', tools: [] });
      expect(scope.label).toBe('cart');
    });

    it('label uses the provided value when given', () => {
      const scope = new Scope({ name: 'cart', label: 'Shopping Cart', tools: [] });
      expect(scope.label).toBe('Shopping Cart');
    });

    it('tools getter returns the registered array', () => {
      const a = makeTool('a');
      const b = makeTool('b');
      const scope = new Scope({ name: 'x', tools: [a, b] });
      expect(scope.tools).toEqual([a, b]);
    });

    it('tools defaults to an empty array when omitted', () => {
      const scope = new Scope({ name: 'x' });
      expect(scope.tools).toEqual([]);
    });

    it('getEnabledTools returns an empty array when no tools were provided', () => {
      const scope = new Scope({ name: 'x' });
      expect(scope.getEnabledTools()).toEqual([]);
    });

    it('getEnabledTools returns an empty array when no tools were provided and scope is disabled', () => {
      const scope = new Scope({ name: 'x', enabled: () => false });
      expect(scope.getEnabledTools()).toEqual([]);
    });

    it('a context-only scope (no tools) is valid and resolves its context', () => {
      const scope = new Scope({
        name: 'app-state',
        context: () => ({ route: '/cart' }),
      });

      expect(scope.tools).toEqual([]);
      expect(scope.getContext()).toEqual({
        label: 'app-state',
        injection: 'system',
        content: { route: '/cart' },
      });
    });

    it('injection getter returns the configured strategy', () => {
      const a = new Scope({ name: 'a', injection: 'user' });
      const b = new Scope({ name: 'b', injection: 'system' });
      const def = new Scope({ name: 'def' });

      expect(a.injection).toBe('user');
      expect(b.injection).toBe('system');
      expect(def.injection).toBe('system'); // default
    });

    it('context getter returns the original resolver function', () => {
      const fn = () => ({ x: 1 });
      const scope = new Scope({ name: 'x', tools: [], context: fn });
      expect(scope.context).toBe(fn);
    });

    it('context getter returns undefined when no resolver was provided', () => {
      const scope = new Scope({ name: 'x', tools: [] });
      expect(scope.context).toBeUndefined();
    });

    it('enabled getter returns the original enabled function', () => {
      const fn = () => true;
      const scope = new Scope({ name: 'x', tools: [], enabled: fn });
      expect(scope.enabled).toBe(fn);
    });

    it('enabled getter returns undefined when no enabled was provided', () => {
      const scope = new Scope({ name: 'x', tools: [] });
      expect(scope.enabled).toBeUndefined();
    });
  });

  describe('Scope::isEnabled', () => {
    it('returns true when no `enabled` was provided', () => {
      const scope = new Scope({ name: 'x', tools: [] });
      expect(scope.isEnabled()).toBe(true);
    });

    it('returns true when `enabled` returns true', () => {
      const scope = new Scope({ name: 'x', tools: [], enabled: () => true });
      expect(scope.isEnabled()).toBe(true);
    });

    it('returns false when `enabled` returns false', () => {
      const scope = new Scope({ name: 'x', tools: [], enabled: () => false });
      expect(scope.isEnabled()).toBe(false);
    });

    it('returns false when `enabled` throws', () => {
      const scope = new Scope({
        name: 'x',
        tools: [],
        enabled: () => {
          throw new Error('boom');
        },
      });
      expect(scope.isEnabled()).toBe(false);
    });

    it('re-evaluates `enabled` on each call', () => {
      let flag = true;
      const scope = new Scope({ name: 'x', tools: [], enabled: () => flag });

      expect(scope.isEnabled()).toBe(true);
      flag = false;
      expect(scope.isEnabled()).toBe(false);
      flag = true;
      expect(scope.isEnabled()).toBe(true);
    });
  });

  describe('Scope::getEnabledTools', () => {
    it('returns all tools when scope and every tool are enabled', () => {
      const a = makeTool('a');
      const b = makeTool('b');
      const scope = new Scope({ name: 'x', tools: [a, b] });

      expect(scope.getEnabledTools()).toEqual([a, b]);
    });

    it('returns empty array when scope is disabled', () => {
      const a = makeTool('a');
      const scope = new Scope({ name: 'x', tools: [a], enabled: () => false });

      expect(scope.getEnabledTools()).toEqual([]);
    });

    it('returns empty array when scope `enabled` throws', () => {
      const a = makeTool('a');
      const scope = new Scope({
        name: 'x',
        tools: [a],
        enabled: () => {
          throw new Error('boom');
        },
      });

      expect(scope.getEnabledTools()).toEqual([]);
    });

    it('filters out tools whose own `isEnabled()` returns false', () => {
      const a = makeTool('a', () => true);
      const b = makeTool('b', () => false);
      const scope = new Scope({ name: 'x', tools: [a, b] });

      expect(scope.getEnabledTools()).toEqual([a]);
    });

    it('filters out tools whose `enabled` throws', () => {
      const a = makeTool('a', () => true);
      const b = makeTool('b', () => {
        throw new Error('tool boom');
      });
      const scope = new Scope({ name: 'x', tools: [a, b] });

      expect(scope.getEnabledTools()).toEqual([a]);
    });

    it('returns empty array when the scope has no tools', () => {
      const scope = new Scope({ name: 'x', tools: [] });
      expect(scope.getEnabledTools()).toEqual([]);
    });

    it('re-evaluates on each call (reflects state changes)', () => {
      let toolFlag = true;
      const a = makeTool('a', () => toolFlag);
      const scope = new Scope({ name: 'x', tools: [a] });

      expect(scope.getEnabledTools()).toEqual([a]);
      toolFlag = false;
      expect(scope.getEnabledTools()).toEqual([]);
    });
  });

  describe('Scope::getContext', () => {
    it('returns a ScopeContext when the scope is enabled and a resolver is provided', () => {
      const scope = new Scope({
        name: 'x',
        tools: [],
        context: () => ({ items: [1, 2, 3] }),
      });

      expect(scope.getContext()).toEqual({
        label: 'x',
        injection: 'system',
        content: { items: [1, 2, 3] },
      });
    });

    it('uses the scope label (when provided) for the ScopeContext', () => {
      const scope = new Scope({
        name: 'cart',
        label: 'Shopping Cart',
        context: () => ({ total: 42 }),
      });

      expect(scope.getContext()).toEqual({
        label: 'Shopping Cart',
        injection: 'system',
        content: { total: 42 },
      });
    });

    it('carries the configured injection strategy', () => {
      const scope = new Scope({
        name: 'cart',
        injection: 'user',
        context: () => ({ items: [] }),
      });

      expect(scope.getContext()?.injection).toBe('user');
    });

    it('returns undefined when no context resolver was provided', () => {
      const scope = new Scope({ name: 'x' });
      expect(scope.getContext()).toBeUndefined();
    });

    it('returns undefined when the scope is disabled', () => {
      const scope = new Scope({
        name: 'x',
        enabled: () => false,
        context: () => ({ should: 'not appear' }),
      });

      expect(scope.getContext()).toBeUndefined();
    });

    it('returns undefined when scope `enabled` throws', () => {
      const scope = new Scope({
        name: 'x',
        enabled: () => {
          throw new Error('scope boom');
        },
        context: () => ({ should: 'not appear' }),
      });

      expect(scope.getContext()).toBeUndefined();
    });

    it('returns undefined when the context resolver throws', () => {
      const scope = new Scope({
        name: 'x',
        context: () => {
          throw new Error('resolver boom');
        },
      });

      expect(scope.getContext()).toBeUndefined();
    });

    it('re-resolves on each call (reflects state changes)', () => {
      let counter = 0;
      const scope = new Scope({
        name: 'x',
        context: () => ({ counter: ++counter }),
      });

      expect(scope.getContext()?.content).toEqual({ counter: 1 });
      expect(scope.getContext()?.content).toEqual({ counter: 2 });
      expect(scope.getContext()?.content).toEqual({ counter: 3 });
    });
  });
});
