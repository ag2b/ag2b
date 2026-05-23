import { Scope, Tool } from '@ag2b/core';
import z from 'zod/v4';

import { webmcp } from '../plugin';
import { installFakeModelContext, makeAgent, makeScope, sumTool } from './fixtures';

describe('webmcp() — feature detection', () => {
  afterEach(() => {
    if ('modelContext' in navigator) {
      delete (navigator as { modelContext?: unknown }).modelContext;
    }
  });

  it('returns a no-op cleanup when navigator.modelContext is absent', async () => {
    const agent = makeAgent();

    const cleanup = await agent.use(webmcp());

    expect(cleanup).toBeTypeOf('function');
    expect(() => cleanup?.()).not.toThrow();
  });

  it('returns a cleanup even when modelContext is present (smoke)', async () => {
    const { uninstall } = installFakeModelContext();
    try {
      const agent = makeAgent();
      const cleanup = await agent.use(webmcp());
      expect(cleanup).toBeTypeOf('function');
      cleanup?.();
    } finally {
      uninstall();
    }
  });
});

describe('webmcp() — initial registration', () => {
  afterEach(() => {
    if ('modelContext' in navigator) {
      delete (navigator as { modelContext?: unknown }).modelContext;
    }
  });

  it('registers tools for scopes that exist before install', async () => {
    const { registered } = installFakeModelContext();
    const agent = makeAgent();
    agent.scopes.register(makeScope('math', [sumTool('sum')]));

    await agent.use(webmcp());

    expect(registered).toHaveLength(1);
    expect(registered[0]).toMatchObject({
      name: 'sum',
      description: 'Sum two numbers',
    });
    expect(registered[0]?.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    });
    expect(registered[0]?.execute).toBeTypeOf('function');
    expect(registered[0]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('webmcp() — onScopeRegister', () => {
  afterEach(() => {
    if ('modelContext' in navigator) {
      delete (navigator as { modelContext?: unknown }).modelContext;
    }
  });

  it('registers tools for scopes added after install', async () => {
    const { registered } = installFakeModelContext();
    const agent = makeAgent();
    await agent.use(webmcp());

    agent.scopes.register(makeScope('math', [sumTool('sum')]));

    expect(registered).toHaveLength(1);
    expect(registered[0]?.name).toBe('sum');
  });
});

describe('webmcp() — onScopeUnregister', () => {
  afterEach(() => {
    if ('modelContext' in navigator) {
      delete (navigator as { modelContext?: unknown }).modelContext;
    }
  });

  it('aborts every controller for a scope when it is unregistered', async () => {
    const { registered } = installFakeModelContext();
    const agent = makeAgent();
    agent.scopes.register(makeScope('math', [sumTool('sum'), sumTool('sum2')]));
    await agent.use(webmcp());

    expect(registered).toHaveLength(2);
    const signals = registered.map((r) => r.signal);
    expect(signals.every((s) => s?.aborted === false)).toBe(true);

    agent.scopes.unregister('math');

    expect(signals.every((s) => s?.aborted === true)).toBe(true);
  });
});

describe('webmcp() — execute wrapper', () => {
  afterEach(() => {
    if ('modelContext' in navigator) {
      delete (navigator as { modelContext?: unknown }).modelContext;
    }
  });

  it('calls the underlying handler with validated arguments and returns the result', async () => {
    const { registered } = installFakeModelContext();
    const agent = makeAgent();
    agent.scopes.register(makeScope('math', [sumTool('sum')]));
    await agent.use(webmcp());

    const exec = registered[0]?.execute;
    expect(exec).toBeTypeOf('function');

    await expect(exec!({ a: 2, b: 3 })).resolves.toBe(5);
  });

  it('rejects when input fails the tool schema', async () => {
    const { registered } = installFakeModelContext();
    const agent = makeAgent();
    agent.scopes.register(makeScope('math', [sumTool('sum')]));
    await agent.use(webmcp());

    const exec = registered[0]?.execute;
    await expect(exec!({ a: 'not-a-number', b: 3 })).rejects.toThrow();
  });
});

describe('webmcp() — disabled gating', () => {
  afterEach(() => {
    if ('modelContext' in navigator) {
      delete (navigator as { modelContext?: unknown }).modelContext;
    }
  });

  it('rejects when the tool is disabled at call time', async () => {
    const { registered } = installFakeModelContext();
    const agent = makeAgent();
    let enabled = true;
    const tool = new Tool({
      name: 'maybe',
      description: 'Maybe runs',
      parameters: z.object({}),
      handler: () => 'ok',
      enabled: () => enabled,
    });
    agent.scopes.register(makeScope('s', [tool]));
    await agent.use(webmcp());

    const exec = registered[0]?.execute;
    await expect(exec!({})).resolves.toBe('ok');

    enabled = false;
    await expect(exec!({})).rejects.toThrow('Tool "maybe" is disabled');
  });

  it('rejects when the scope is disabled at call time', async () => {
    const { registered } = installFakeModelContext();
    const agent = makeAgent();
    let scopeEnabled = true;
    const scope = new Scope({
      name: 's',
      tools: [sumTool('sum')],
      enabled: () => scopeEnabled,
    });
    agent.scopes.register(scope);
    await agent.use(webmcp());

    const exec = registered[0]?.execute;
    await expect(exec!({ a: 1, b: 2 })).resolves.toBe(3);

    scopeEnabled = false;
    await expect(exec!({ a: 1, b: 2 })).rejects.toThrow('Tool "sum" is disabled');
  });
});

describe('webmcp() — cleanup', () => {
  afterEach(() => {
    if ('modelContext' in navigator) {
      delete (navigator as { modelContext?: unknown }).modelContext;
    }
  });

  it('aborts every controller and stops reacting to scope changes', async () => {
    const { registered } = installFakeModelContext();
    const agent = makeAgent();
    agent.scopes.register(makeScope('a', [sumTool('a1')]));
    agent.scopes.register(makeScope('b', [sumTool('b1')]));

    const cleanup = await agent.use(webmcp());

    expect(registered).toHaveLength(2);
    const signals = registered.map((r) => r.signal);
    expect(signals.every((s) => s?.aborted === false)).toBe(true);

    cleanup?.();

    expect(signals.every((s) => s?.aborted === true)).toBe(true);

    // Subsequent registrations are NOT mirrored.
    agent.scopes.register(makeScope('c', [sumTool('c1')]));
    expect(registered).toHaveLength(2);
  });

  it('does not throw when a scope is unregistered after cleanup', async () => {
    installFakeModelContext();
    const agent = makeAgent();
    agent.scopes.register(makeScope('a', [sumTool('a1')]));

    const cleanup = await agent.use(webmcp());
    cleanup?.();

    expect(() => agent.scopes.unregister('a')).not.toThrow();
  });
});
