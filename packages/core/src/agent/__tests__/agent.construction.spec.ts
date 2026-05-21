import { History } from '@/history';
import { ScopeRegistry } from '@/scope';

import { Agent } from '../agent';
import { ScriptedProvider } from './fixtures';

describe('Agent', () => {
  describe('Agent::construction', () => {
    it('exposes a History instance via .history', () => {
      const agent = new Agent({ provider: new ScriptedProvider([{ content: 'x' }]) });
      expect(agent.history).toBeInstanceOf(History);
    });

    it('exposes a ScopeRegistry via .scopes', () => {
      const agent = new Agent({ provider: new ScriptedProvider([{ content: 'x' }]) });
      expect(agent.scopes).toBeInstanceOf(ScopeRegistry);
    });
  });

  describe('Agent::use', () => {
    it('invokes the plugin with the agent and returns undefined when plugin returns void', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const fn = vi.fn();

      const cleanup = await agent.use((a) => {
        fn(a);
      });

      expect(fn).toHaveBeenCalledWith(agent);
      expect(cleanup).toBeUndefined();
    });

    it('returns the plugin cleanup function when one is provided', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const cleanup = vi.fn();

      const dispose = await agent.use(() => cleanup);

      expect(dispose).toBe(cleanup);
      expect(cleanup).not.toHaveBeenCalled();
    });

    it('awaits async plugin setup before resolving', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      let setupComplete = false;

      const dispose = await agent.use(async () => {
        await new Promise((r) => setTimeout(r, 10));
        setupComplete = true;
      });

      expect(setupComplete).toBe(true);
      expect(dispose).toBeUndefined();
    });

    it('awaits async plugin and returns its cleanup', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });
      const cleanup = vi.fn();

      const dispose = await agent.use(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return cleanup;
      });

      expect(dispose).toBe(cleanup);
    });

    it('propagates a plugin throw to the caller', async () => {
      const provider = new ScriptedProvider([{ content: 'ok', finishReason: 'stop' }]);
      const agent = new Agent({ provider });

      await expect(
        agent.use(() => {
          throw new Error('plugin boom');
        })
      ).rejects.toThrow('plugin boom');
    });

    it('cleanup actually removes hooks the plugin registered', async () => {
      const provider = new ScriptedProvider([
        { content: 'first', finishReason: 'stop' },
        { content: 'second', finishReason: 'stop' },
      ]);
      const agent = new Agent({ provider });
      const fn = vi.fn();

      const dispose = await agent.use((a) => a.addHook('onChatDone', fn));

      await agent.chat('one');
      expect(fn).toHaveBeenCalledTimes(1);

      dispose?.();

      await agent.chat('two');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
