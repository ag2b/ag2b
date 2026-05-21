import { Scope } from '@/scope';

import { Agent, createAgent } from '../agent';
import { ScriptedProvider, sumTool } from './fixtures';

describe('createAgent', () => {
  it('returns an Agent instance', () => {
    const agent = createAgent({ provider: new ScriptedProvider([{ content: 'x' }]) });

    expect(agent).toBeInstanceOf(Agent);
  });

  it('returns a new instance on each call (independent history and scopes)', () => {
    const provider = new ScriptedProvider([{ content: 'x' }, { content: 'y' }]);
    const a = createAgent({ provider });
    const b = createAgent({ provider });

    expect(a).not.toBe(b);
    expect(a.history).not.toBe(b.history);
    expect(a.scopes).not.toBe(b.scopes);
  });

  it('registers a scope passed via the scopes argument', () => {
    const provider = new ScriptedProvider([{ content: 'x' }]);
    const scope = new Scope({ name: 'cart', tools: [sumTool()] });

    const agent = createAgent({ provider }, [scope]);

    expect(agent.scopes.get('cart')).toBe(scope);
  });

  it('registers multiple scopes in argument order', () => {
    const provider = new ScriptedProvider([{ content: 'x' }]);
    const cart = new Scope({ name: 'cart' });
    const checkout = new Scope({ name: 'checkout' });

    const agent = createAgent({ provider }, [cart, checkout]);

    expect(agent.scopes.getSnapshot()).toEqual([cart, checkout]);
  });

  it('registers no scopes when the argument is omitted', () => {
    const provider = new ScriptedProvider([{ content: 'x' }]);

    const agent = createAgent({ provider });

    expect(agent.scopes.getSnapshot()).toEqual([]);
  });

  it('makes tools from a pre-registered scope callable end-to-end', async () => {
    const provider = new ScriptedProvider([
      {
        calls: [{ id: 'c1', name: 'sum', arguments: { a: 1, b: 2 } }],
        finishReason: 'tool_calls',
      },
      { content: 'sum is 3', finishReason: 'stop' },
    ]);

    const agent = createAgent({ provider }, [new Scope({ name: 'app', tools: [sumTool()] })]);

    const response = await agent.chat('add');

    expect(response.content).toBe('sum is 3');
    expect(agent.history.getSnapshot()).toContainEqual({ role: 'tool', id: 'c1', content: '3' });
  });

  it('throws when two scopes in the argument share a name', () => {
    const provider = new ScriptedProvider([{ content: 'x' }]);

    expect(() =>
      createAgent({ provider }, [new Scope({ name: 'dup' }), new Scope({ name: 'dup' })])
    ).toThrow('Scope "dup" already registered');
  });
});
