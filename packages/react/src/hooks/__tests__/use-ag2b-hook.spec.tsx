import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';

import { makeAgent, wrapper } from '../../__tests__/fixtures';
import { useAg2bHook } from '../use-ag2b-hook';

describe('useAg2bHook', () => {
  it('registers a hook on mount and disposes on unmount', async () => {
    const agent = makeAgent([
      { content: 'pong', finishReason: 'stop' },
      { content: 'after-pong', finishReason: 'stop' },
    ]);
    const spy = vi.spyOn(agent, 'addHook');

    const seen: string[] = [];
    const { unmount } = renderHook(
      () =>
        useAg2bHook('onMessage', (ctx) => {
          if (ctx.message.role === 'user') seen.push(ctx.message.content);
        }),
      { wrapper: wrapper(agent) }
    );

    expect(spy).toHaveBeenCalledTimes(1);
    await agent.chat('hi');
    expect(seen).toEqual(['hi']);

    unmount();
    await agent.chat('after');
    expect(seen).toEqual(['hi']); // hook was disposed
  });

  it('does not re-register on re-render with inline arrow callbacks', () => {
    const agent = makeAgent([
      { content: 'resp1', finishReason: 'stop' },
      { content: 'resp2', finishReason: 'stop' },
      { content: 'resp3', finishReason: 'stop' },
    ]);
    const spy = vi.spyOn(agent, 'addHook');

    const useTest = () => {
      const [count, setCount] = useState(0);
      useAg2bHook('onMessage', () => {
        // closure captures count — different identity every render
        void count;
      });
      return setCount;
    };

    const { result } = renderHook(useTest, { wrapper: wrapper(agent) });
    expect(spy).toHaveBeenCalledTimes(1);

    act(() => result.current(1));
    act(() => result.current(2));
    act(() => result.current(3));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fires the latest closure when the hook event triggers', async () => {
    const agent = makeAgent([
      { content: 'resp1', finishReason: 'stop' },
      { content: 'resp2', finishReason: 'stop' },
    ]);
    const seen: number[] = [];

    const useTest = () => {
      const [count, setCount] = useState(0);
      useAg2bHook('onMessage', (ctx) => {
        if (ctx.message.role === 'user') seen.push(count);
      });
      return setCount;
    };

    const { result } = renderHook(useTest, { wrapper: wrapper(agent) });

    await agent.chat('first');
    expect(seen).toEqual([0]);

    act(() => result.current(7));
    await agent.chat('second');
    expect(seen).toEqual([0, 7]);
  });
});
