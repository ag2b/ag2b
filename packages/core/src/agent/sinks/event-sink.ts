import type { AgentEvent } from '../event';

/**
 * Channel through which the agent loop emits events. Two implementations:
 * - AsyncQueue — buffers + iterable, used by chatStream consumers.
 * - CallbackSink — forwards push() to a callback, used by chat({ onEvent }).
 */
export interface EventSink {
  push(event: AgentEvent): this;
  end?(): void;
  error?(err: Error): void;
}
