import type { AgentEvent } from '../../event';
import { AsyncQueue } from '../async-queue';
import type { EventSink } from '../event-sink';

const e = (delta: string): AgentEvent => ({ type: 'agent_content_delta', delta });
const END: AgentEvent = { type: 'agent_content_end' };

async function collect(queue: AsyncQueue): Promise<AgentEvent[]> {
  const items: AgentEvent[] = [];
  for await (const item of queue) {
    items.push(item);
  }
  return items;
}

describe('AsyncQueue', () => {
  it('yields pushed items in order', async () => {
    const queue = new AsyncQueue();

    queue.push(e('a'));
    queue.push(e('b'));
    queue.push(e('c'));
    queue.end();

    const items = await collect(queue);
    expect(items).toEqual([e('a'), e('b'), e('c')]);
  });

  it('yields items pushed after iteration starts', async () => {
    const queue = new AsyncQueue();

    const promise = collect(queue);

    queue.push(e('a'));
    queue.push(e('b'));
    queue.end();

    const items = await promise;
    expect(items).toEqual([e('a'), e('b')]);
  });

  it('blocks until items are available', async () => {
    const queue = new AsyncQueue();
    const items: AgentEvent[] = [];

    const promise = (async () => {
      for await (const item of queue) {
        items.push(item);
      }
    })();

    // Nothing yielded yet
    await new Promise((r) => setTimeout(r, 10));
    expect(items).toEqual([]);

    queue.push(e('first'));
    await new Promise((r) => setTimeout(r, 10));
    expect(items).toEqual([e('first')]);

    queue.push(e('second'));
    queue.end();
    await promise;
    expect(items).toEqual([e('first'), e('second')]);
  });

  it('ends when end() is called with empty buffer', async () => {
    const queue = new AsyncQueue();

    queue.end();

    const items = await collect(queue);
    expect(items).toEqual([]);
  });

  it('yields buffered items before ending', async () => {
    const queue = new AsyncQueue();

    queue.push(e('a'));
    queue.push(END);
    queue.end();

    const items = await collect(queue);
    expect(items).toEqual([e('a'), END]);
  });

  it('throws when pushing after end', () => {
    const queue = new AsyncQueue();

    queue.end();

    expect(() => queue.push(e('a'))).toThrow('Cannot push to an ended queue');
  });

  it('throws when erroring after end', () => {
    const queue = new AsyncQueue();

    queue.end();

    expect(() => queue.error(new Error('late'))).toThrow('Cannot error an ended queue');
  });

  it('throws when error() is called', async () => {
    const queue = new AsyncQueue();

    queue.error(new Error('test error'));

    await expect(collect(queue)).rejects.toThrow('test error');
  });

  it('yields buffered items before throwing', async () => {
    const queue = new AsyncQueue();
    const items: AgentEvent[] = [];

    queue.push(e('a'));
    queue.push(e('b'));
    queue.error(new Error('fail'));

    try {
      for await (const item of queue) {
        items.push(item);
      }
    } catch {
      // expected
    }

    expect(items).toEqual([e('a'), e('b')]);
  });

  it('throws error to a waiting consumer', async () => {
    const queue = new AsyncQueue();

    const promise = collect(queue);

    queue.error(new Error('async fail'));

    await expect(promise).rejects.toThrow('async fail');
  });

  it('handles interleaved push and consume', async () => {
    const queue = new AsyncQueue();
    const items: AgentEvent[] = [];

    const promise = (async () => {
      for await (const item of queue) {
        items.push(item);
      }
    })();

    for (let i = 0; i < 5; i++) {
      queue.push(e(String(i)));
      await new Promise((r) => setTimeout(r, 5));
    }
    queue.end();

    await promise;
    expect(items).toEqual([e('0'), e('1'), e('2'), e('3'), e('4')]);
  });
});

describe('AsyncQueue as EventSink', () => {
  it('satisfies the EventSink interface', () => {
    const sink: EventSink = new AsyncQueue();
    sink.push({ type: 'agent_content_end' });
    expect(sink).toBeDefined();
  });
});
