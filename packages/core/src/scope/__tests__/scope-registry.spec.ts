import z from 'zod/v4';

import { Ag2bError } from '@/errors';
import { Tool } from '@/tool';

import { Scope } from '../scope';
import { ScopeRegistry } from '../scope-registry';

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

const makeScope = (
  name: string,
  tools: Tool[] = [],
  enabled?: () => boolean,
  context?: () => unknown
) => new Scope({ name, tools, enabled, context });

describe('ScopeRegistry', () => {
  let registry: ScopeRegistry;

  beforeEach(() => {
    registry = new ScopeRegistry();
  });

  describe('ScopeRegistry::register', () => {
    it('registers a scope and indexes its tools', () => {
      const a = makeTool('a');
      const b = makeTool('b');
      const scope = makeScope('cart', [a, b]);

      registry.register(scope);

      expect(registry.get('cart')).toBe(scope);
      expect(registry.findTool('a')).toEqual({ tool: a, scope, enabled: true });
      expect(registry.findTool('b')).toEqual({ tool: b, scope, enabled: true });
    });

    it('registers a scope with no tools', () => {
      const scope = makeScope('empty');
      registry.register(scope);

      expect(registry.get('empty')).toBe(scope);
    });

    it('throws Ag2bError on duplicate scope name', () => {
      registry.register(makeScope('cart'));

      expect(() => registry.register(makeScope('cart'))).toThrow(Ag2bError);
      expect(() => registry.register(makeScope('cart'))).toThrow(/Scope "cart"/);
    });

    it('throws Ag2bError on tool name collision across scopes', () => {
      registry.register(makeScope('cart', [makeTool('shared')]));

      expect(() => registry.register(makeScope('inventory', [makeTool('shared')]))).toThrow(
        Ag2bError
      );
      expect(() => registry.register(makeScope('inventory', [makeTool('shared')]))).toThrow(
        /Tool "shared".*scope "cart"/
      );
    });

    it('does not commit a scope when one of its tools collides', () => {
      registry.register(makeScope('cart', [makeTool('shared')]));

      try {
        registry.register(makeScope('mixed', [makeTool('newTool'), makeTool('shared')]));
      } catch {
        // expected
      }

      // mixed scope was not added — neither its name nor its non-colliding tool
      expect(registry.get('mixed')).toBeUndefined();
      expect(registry.findTool('newTool')).toBeUndefined();
      // existing scope is intact
      expect(registry.get('cart')).toBeDefined();
      expect(registry.findTool('shared')?.scope.name).toBe('cart');
    });
  });

  describe('ScopeRegistry::unregister', () => {
    it('removes the scope and de-indexes its tools', () => {
      const a = makeTool('a');
      registry.register(makeScope('cart', [a]));

      registry.unregister('cart');

      expect(registry.get('cart')).toBeUndefined();
      expect(registry.findTool('a')).toBeUndefined();
    });

    it('is a no-op when scope name is not registered', () => {
      registry.register(makeScope('cart', [makeTool('a')]));

      expect(() => registry.unregister('missing')).not.toThrow();
      expect(registry.get('cart')).toBeDefined();
      expect(registry.findTool('a')).toBeDefined();
    });

    it('frees tool names so they can be re-registered after unregister', () => {
      registry.register(makeScope('cart', [makeTool('shared')]));
      registry.unregister('cart');

      // Was previously colliding; now succeeds
      expect(() => registry.register(makeScope('inventory', [makeTool('shared')]))).not.toThrow();
      expect(registry.findTool('shared')?.scope.name).toBe('inventory');
    });
  });

  describe('ScopeRegistry::get', () => {
    it('returns the scope by name', () => {
      const scope = makeScope('cart');
      registry.register(scope);

      expect(registry.get('cart')).toBe(scope);
    });

    it('returns undefined for unknown name', () => {
      expect(registry.get('missing')).toBeUndefined();
    });
  });

  describe('ScopeRegistry::list', () => {
    it('returns an empty array initially', () => {
      expect(registry.getSnapshot()).toEqual([]);
    });

    it('returns all registered scopes', () => {
      const a = makeScope('a');
      const b = makeScope('b');
      registry.register(a);
      registry.register(b);

      expect(registry.getSnapshot()).toEqual([a, b]);
    });

    it('returns the same reference on repeated calls when nothing has changed', () => {
      registry.register(makeScope('a'));

      expect(registry.getSnapshot()).toBe(registry.getSnapshot());
    });
  });

  describe('ScopeRegistry::findTool', () => {
    it('returns the tool, its owning scope, and `enabled: true` when active', () => {
      const tool = makeTool('a');
      const scope = makeScope('cart', [tool]);
      registry.register(scope);

      expect(registry.findTool('a')).toEqual({ tool, scope, enabled: true });
    });

    it('returns undefined for an unknown tool name', () => {
      registry.register(makeScope('cart', [makeTool('a')]));

      expect(registry.findTool('missing')).toBeUndefined();
    });

    it('returns the entry with `enabled: false` when the owning scope is disabled', () => {
      const tool = makeTool('a');
      const scope = makeScope('cart', [tool], () => false);
      registry.register(scope);

      expect(registry.findTool('a')).toEqual({ tool, scope, enabled: false });
    });

    it("returns the entry with `enabled: false` when the tool's own `enabled` returns false", () => {
      const tool = makeTool('a', () => false);
      const scope = makeScope('cart', [tool]);
      registry.register(scope);

      expect(registry.findTool('a')).toEqual({ tool, scope, enabled: false });
    });

    it('returns `enabled: false` when the tool `enabled` throws', () => {
      const tool = makeTool('a', () => {
        throw new Error('boom');
      });
      const scope = makeScope('cart', [tool]);
      registry.register(scope);

      expect(registry.findTool('a')).toEqual({ tool, scope, enabled: false });
    });

    it('returns `enabled: false` when the scope `enabled` throws', () => {
      const tool = makeTool('a');
      const scope = makeScope('cart', [tool], () => {
        throw new Error('boom');
      });
      registry.register(scope);

      expect(registry.findTool('a')).toEqual({ tool, scope, enabled: false });
    });

    it('re-evaluates the `enabled` flag on every call (reflects state changes)', () => {
      let toolFlag = true;
      const tool = makeTool('a', () => toolFlag);
      const scope = makeScope('cart', [tool]);
      registry.register(scope);

      expect(registry.findTool('a')).toEqual({ tool, scope, enabled: true });
      toolFlag = false;
      expect(registry.findTool('a')).toEqual({ tool, scope, enabled: false });
      toolFlag = true;
      expect(registry.findTool('a')).toEqual({ tool, scope, enabled: true });
    });
  });

  describe('ScopeRegistry::getEnabledTools', () => {
    it('returns all tools when scopes and tools are all enabled', () => {
      const a = makeTool('a');
      const b = makeTool('b');
      registry.register(makeScope('cart', [a, b]));

      expect(registry.getEnabledTools()).toEqual([a, b]);
    });

    it('returns empty when no scopes registered', () => {
      expect(registry.getEnabledTools()).toEqual([]);
    });

    it('skips all tools from a disabled scope (scope gate trumps tool gate)', () => {
      const a = makeTool('a', () => true); // tool itself enabled
      const b = makeTool('b'); // tool itself enabled
      registry.register(makeScope('cart', [a, b], () => false));

      expect(registry.getEnabledTools()).toEqual([]);
    });

    it('skips individual tools whose own enabled returns false', () => {
      const a = makeTool('a', () => true);
      const b = makeTool('b', () => false);
      registry.register(makeScope('cart', [a, b]));

      expect(registry.getEnabledTools()).toEqual([a]);
    });

    it('skips tools whose enabled throws', () => {
      const a = makeTool('a', () => true);
      const b = makeTool('b', () => {
        throw new Error('boom');
      });
      registry.register(makeScope('cart', [a, b]));

      expect(registry.getEnabledTools()).toEqual([a]);
    });

    it('skips a scope whose enabled throws (treated as false)', () => {
      const a = makeTool('a');
      registry.register(
        makeScope('cart', [a], () => {
          throw new Error('boom');
        })
      );

      expect(registry.getEnabledTools()).toEqual([]);
    });

    it('aggregates across multiple scopes', () => {
      const a = makeTool('a');
      const b = makeTool('b');
      const c = makeTool('c');
      registry.register(makeScope('one', [a, b]));
      registry.register(makeScope('two', [c]));

      expect(registry.getEnabledTools()).toEqual([a, b, c]);
    });

    it('re-evaluates per call (reflects state changes between calls)', () => {
      let scopeFlag = true;
      const a = makeTool('a');
      registry.register(makeScope('cart', [a], () => scopeFlag));

      expect(registry.getEnabledTools()).toEqual([a]);
      scopeFlag = false;
      expect(registry.getEnabledTools()).toEqual([]);
      scopeFlag = true;
      expect(registry.getEnabledTools()).toEqual([a]);
    });
  });

  describe('ScopeRegistry::getContexts', () => {
    it('returns an empty array when no scopes are registered', () => {
      expect(registry.getContexts()).toEqual([]);
    });

    it('returns a ScopeContext per enabled scope with a resolver', () => {
      registry.register(new Scope({ name: 'a', context: () => ({ x: 1 }) }));
      registry.register(new Scope({ name: 'b', context: () => ({ y: 2 }) }));

      expect(registry.getContexts()).toEqual([
        { label: 'a', injection: 'system', content: { x: 1 } },
        { label: 'b', injection: 'system', content: { y: 2 } },
      ]);
    });

    it('skips scopes without a context resolver', () => {
      registry.register(new Scope({ name: 'no-ctx' }));
      registry.register(new Scope({ name: 'with-ctx', context: () => ({ x: 1 }) }));

      expect(registry.getContexts()).toEqual([
        { label: 'with-ctx', injection: 'system', content: { x: 1 } },
      ]);
    });

    it('skips disabled scopes', () => {
      registry.register(
        new Scope({ name: 'off', enabled: () => false, context: () => ({ x: 1 }) })
      );
      registry.register(new Scope({ name: 'on', context: () => ({ y: 2 }) }));

      expect(registry.getContexts()).toEqual([
        { label: 'on', injection: 'system', content: { y: 2 } },
      ]);
    });

    it('skips scopes whose context resolver throws', () => {
      registry.register(
        new Scope({
          name: 'broken',
          context: () => {
            throw new Error('boom');
          },
        })
      );
      registry.register(new Scope({ name: 'fine', context: () => ({ x: 1 }) }));

      expect(registry.getContexts()).toEqual([
        { label: 'fine', injection: 'system', content: { x: 1 } },
      ]);
    });

    it("preserves each scope's configured injection strategy", () => {
      registry.register(new Scope({ name: 'stable', injection: 'system', context: () => ({}) }));
      registry.register(new Scope({ name: 'volatile', injection: 'user', context: () => ({}) }));

      const contexts = registry.getContexts();
      expect(contexts).toHaveLength(2);
      expect(contexts[0]?.injection).toBe('system');
      expect(contexts[1]?.injection).toBe('user');
    });

    it("uses each scope's label as the ScopeContext label", () => {
      registry.register(
        new Scope({
          name: 'cart',
          label: 'Shopping Cart',
          context: () => ({ items: [] }),
        })
      );

      expect(registry.getContexts()[0]?.label).toBe('Shopping Cart');
    });

    it('re-evaluates per call (reflects state changes between calls)', () => {
      let flag = true;
      registry.register(
        new Scope({
          name: 'x',
          enabled: () => flag,
          context: () => ({ x: 1 }),
        })
      );

      expect(registry.getContexts()).toHaveLength(1);
      flag = false;
      expect(registry.getContexts()).toEqual([]);
      flag = true;
      expect(registry.getContexts()).toHaveLength(1);
    });
  });

  describe('ScopeRegistry::getSnapshot', () => {
    it('returns an empty array when no scopes registered', () => {
      expect(registry.getSnapshot()).toEqual([]);
    });

    it('returns registered scopes', () => {
      const a = makeScope('a');
      const b = makeScope('b');
      registry.register(a);
      registry.register(b);
      expect(registry.getSnapshot()).toEqual([a, b]);
    });

    it('returns a stable reference when nothing changes', () => {
      registry.register(makeScope('a'));
      const first = registry.getSnapshot();
      const second = registry.getSnapshot();
      expect(second).toBe(first);
    });

    it('returns a new reference after register', () => {
      const first = registry.getSnapshot();
      registry.register(makeScope('a'));
      const second = registry.getSnapshot();
      expect(second).not.toBe(first);
    });

    it('returns a new reference after unregister', () => {
      registry.register(makeScope('a'));
      const before = registry.getSnapshot();
      registry.unregister('a');
      const after = registry.getSnapshot();
      expect(after).not.toBe(before);
      expect(after).toEqual([]);
    });
  });

  describe('ScopeRegistry::subscribe', () => {
    it('notifies a listener on register', () => {
      const listener = vi.fn();
      registry.subscribe(listener);
      registry.register(makeScope('a'));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies a listener on unregister', () => {
      registry.register(makeScope('a'));
      const listener = vi.fn();
      registry.subscribe(listener);
      registry.unregister('a');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify when unregister is called for a missing scope', () => {
      const listener = vi.fn();
      registry.subscribe(listener);
      registry.unregister('nonexistent');
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns an unsubscribe function that stops further notifications', () => {
      const listener = vi.fn();
      const off = registry.subscribe(listener);
      registry.register(makeScope('a'));
      expect(listener).toHaveBeenCalledTimes(1);
      off();
      registry.register(makeScope('b'));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('listener reading getSnapshot inside the callback observes the post-mutation state', () => {
      let observed: string[] = [];
      registry.subscribe(() => {
        observed = registry.getSnapshot().map((s) => s.name);
      });
      registry.register(makeScope('cart'));
      expect(observed).toEqual(['cart']);
    });

    it('onRegister callback fires before subscribe listeners', () => {
      const order: string[] = [];
      const reg = new ScopeRegistry({
        onRegister: () => order.push('onRegister'),
      });
      reg.subscribe(() => order.push('subscribe'));
      reg.register(makeScope('a'));
      expect(order).toEqual(['onRegister', 'subscribe']);
    });

    it('onUnregister callback fires before subscribe listeners', () => {
      const order: string[] = [];
      const reg = new ScopeRegistry({
        onUnregister: () => order.push('onUnregister'),
      });
      reg.register(makeScope('a'));
      reg.subscribe(() => order.push('subscribe'));
      reg.unregister('a');
      expect(order).toEqual(['onUnregister', 'subscribe']);
    });
  });

  describe('ScopeRegistry::callbacks', () => {
    it('fires onRegister with the registered scope', () => {
      const onRegister = vi.fn();
      const r = new ScopeRegistry({ onRegister });
      const scope = makeScope('cart', [makeTool('a')]);

      r.register(scope);

      expect(onRegister).toHaveBeenCalledTimes(1);
      expect(onRegister).toHaveBeenCalledWith(scope);
    });

    it('fires onRegister AFTER the scope is committed (callback sees populated registry)', () => {
      const scope = makeScope('cart', [makeTool('a')]);
      const seen: { hasScope: boolean; hasTool: boolean } = { hasScope: false, hasTool: false };

      const r = new ScopeRegistry({
        onRegister: (s) => {
          seen.hasScope = r.get(s.name) === s;
          seen.hasTool = r.findTool('a')?.tool.name === 'a';
        },
      });

      r.register(scope);
      expect(seen).toEqual({ hasScope: true, hasTool: true });
    });

    it('does NOT fire onRegister when register throws (duplicate scope)', () => {
      const onRegister = vi.fn();
      const r = new ScopeRegistry({ onRegister });
      r.register(makeScope('cart'));
      onRegister.mockClear();

      expect(() => r.register(makeScope('cart'))).toThrow(Ag2bError);
      expect(onRegister).not.toHaveBeenCalled();
    });

    it('does NOT fire onRegister when register throws (tool collision)', () => {
      const onRegister = vi.fn();
      const r = new ScopeRegistry({ onRegister });
      r.register(makeScope('cart', [makeTool('shared')]));
      onRegister.mockClear();

      expect(() => r.register(makeScope('inventory', [makeTool('shared')]))).toThrow(Ag2bError);
      expect(onRegister).not.toHaveBeenCalled();
    });

    it('fires onUnregister with the removed scope', () => {
      const onUnregister = vi.fn();
      const r = new ScopeRegistry({ onUnregister });
      const scope = makeScope('cart', [makeTool('a')]);
      r.register(scope);

      r.unregister('cart');

      expect(onUnregister).toHaveBeenCalledTimes(1);
      expect(onUnregister).toHaveBeenCalledWith(scope);
    });

    it('fires onUnregister AFTER the scope is removed (callback sees empty registry)', () => {
      const scope = makeScope('cart', [makeTool('a')]);
      let seenAtCallback: { hasScope: boolean; hasTool: boolean } | undefined;

      const r = new ScopeRegistry({
        onUnregister: () => {
          seenAtCallback = {
            hasScope: r.get('cart') !== undefined,
            hasTool: r.findTool('a') !== undefined,
          };
        },
      });

      r.register(scope);
      r.unregister('cart');

      expect(seenAtCallback).toEqual({ hasScope: false, hasTool: false });
    });

    it('does NOT fire onUnregister for an unknown name', () => {
      const onUnregister = vi.fn();
      const r = new ScopeRegistry({ onUnregister });

      r.unregister('missing');

      expect(onUnregister).not.toHaveBeenCalled();
    });

    it('disposer returned from register triggers onUnregister', () => {
      const onUnregister = vi.fn();
      const r = new ScopeRegistry({ onUnregister });
      const scope = makeScope('cart');

      const dispose = r.register(scope);
      dispose();

      expect(onUnregister).toHaveBeenCalledTimes(1);
      expect(onUnregister).toHaveBeenCalledWith(scope);
    });

    it('callbacks are independent — providing only one is fine', () => {
      const onRegister = vi.fn();
      const r = new ScopeRegistry({ onRegister });
      const scope = makeScope('cart');

      r.register(scope);
      r.unregister('cart');

      expect(onRegister).toHaveBeenCalledTimes(1);
      // No onUnregister provided — no throw, just silent skip.
    });

    it('works with no config object at all (both callbacks omitted)', () => {
      const r = new ScopeRegistry();
      expect(() => r.register(makeScope('cart'))).not.toThrow();
      expect(() => r.unregister('cart')).not.toThrow();
    });

    it('callback throws propagate to the register caller', () => {
      const r = new ScopeRegistry({
        onRegister: () => {
          throw new Error('hook boom');
        },
      });

      expect(() => r.register(makeScope('cart'))).toThrow('hook boom');
      // But the scope IS registered (mutation happens before the callback).
      expect(r.get('cart')).toBeDefined();
    });

    it('callback throws propagate to the unregister caller', () => {
      const r = new ScopeRegistry({
        onUnregister: () => {
          throw new Error('hook boom');
        },
      });
      r.register(makeScope('cart'));

      expect(() => r.unregister('cart')).toThrow('hook boom');
      // But the scope IS unregistered (mutation happens before the callback).
      expect(r.get('cart')).toBeUndefined();
    });
  });
});
