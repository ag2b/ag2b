import type { AgentEvent } from '../event';
import type { EventSink } from './event-sink';

export class AsyncQueue implements EventSink, AsyncIterable<AgentEvent> {
  private buffer: AgentEvent[] = [];
  private resolve: (() => void) | null = null;
  private done = false;
  private err: Error | null = null;

  /** Push an item into the queue. Unblocks the consumer if it's waiting. Throws if queue is ended. */
  push(item: AgentEvent) {
    if (this.done) {
      throw new Error('Cannot push to an ended queue');
    }

    this.buffer.push(item);
    this.resolve?.();
    this.resolve = null;

    return this;
  }

  /** Signal that no more items will be pushed. */
  end() {
    this.done = true;
    this.resolve?.();
  }

  /** Signal an error. The consumer will throw on next yield. Throws if queue is ended. */
  error(err: Error) {
    if (this.done) {
      throw new Error('Cannot error an ended queue');
    }

    this.err = err;
    this.resolve?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<AgentEvent> {
    while (true) {
      while (this.buffer.length > 0) {
        yield this.buffer.shift()!;
      }

      if (this.err) throw this.err;

      if (this.done) return;

      await new Promise<void>((r) => {
        this.resolve = r;
      });
    }
  }
}
