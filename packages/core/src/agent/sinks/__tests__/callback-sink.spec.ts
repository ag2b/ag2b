import type { AgentEvent } from '../../event';
import { CallbackSink } from '../callback-sink';

describe('CallbackSink', () => {
  it('forwards push() events to the callback', () => {
    const events: AgentEvent[] = [];
    const sink = new CallbackSink((e) => events.push(e));

    sink.push({ type: 'agent_content_end' });
    sink.push({ type: 'agent_chat_done', response: { content: 'hi', finishReason: 'stop' } });

    expect(events).toEqual([
      { type: 'agent_content_end' },
      { type: 'agent_chat_done', response: { content: 'hi', finishReason: 'stop' } },
    ]);
  });

  it('preserves push order', () => {
    const events: AgentEvent[] = [];
    const sink = new CallbackSink((e) => events.push(e));

    sink.push({ type: 'agent_content_end' });
    sink.push({ type: 'agent_content_end' });
    sink.push({ type: 'agent_content_end' });

    expect(events).toHaveLength(3);
  });

  it('push() returns this for chaining', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const sink = new CallbackSink(() => {});
    expect(sink.push({ type: 'agent_content_end' })).toBe(sink);
  });

  it('does not implement end() or error() (optional on EventSink)', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const sink = new CallbackSink(() => {});
    // Sync callers handle completion via the returned Promise; the sink only forwards push().
    expect((sink as unknown as { end?: unknown }).end).toBeUndefined();
    expect((sink as unknown as { error?: unknown }).error).toBeUndefined();
  });
});
