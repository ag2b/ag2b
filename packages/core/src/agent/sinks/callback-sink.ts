import type { AgentEvent } from '../event';
import type { EventSink } from './event-sink';

/**
 * EventSink that forwards every pushed event to a callback. Used by
 * `agent.chat({ onEvent })` so sync callers can observe boundary events
 * without consuming an async iterator. `end()` and `error()` are no-ops —
 * sync callers handle completion via the returned Promise.
 */
export class CallbackSink implements EventSink {
  constructor(private readonly onEvent: (event: AgentEvent) => void) {}

  push(event: AgentEvent): this {
    this.onEvent(event);
    return this;
  }
}
