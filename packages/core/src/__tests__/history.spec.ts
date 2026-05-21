import { History } from '@/history';
import type { ChatMessage } from '@/messages';

describe('History', () => {
  let history: History;

  beforeEach(() => {
    history = new History();
  });

  it('should start with empty messages', () => {
    expect(history.getSnapshot()).toEqual([]);
  });

  it('should push a message', () => {
    const msg: ChatMessage = { role: 'user', content: 'hello' };

    history.push(msg);

    expect(history.getSnapshot()).toEqual([msg]);
  });

  it('should push multiple messages in order', () => {
    const msg1: ChatMessage = { role: 'user', content: 'hello' };
    const msg2: ChatMessage = { role: 'assistant', content: 'hi' };

    history.push(msg1);
    history.push(msg2);

    expect(history.getSnapshot()).toEqual([msg1, msg2]);
  });

  it('should reset messages', () => {
    history.push({ role: 'user', content: 'hello' });
    history.push({ role: 'assistant', content: 'hi' });

    history.reset();

    expect(history.getSnapshot()).toEqual([]);
  });

  it('should allow pushing after reset', () => {
    history.push({ role: 'user', content: 'first' });
    history.reset();

    const msg: ChatMessage = { role: 'user', content: 'second' };
    history.push(msg);

    expect(history.getSnapshot()).toEqual([msg]);
  });

  describe('History::Subscription', () => {
    it('getSnapshot returns empty array initially', () => {
      expect(history.getSnapshot()).toEqual([]);
    });

    it('getSnapshot returns same reference when nothing changed', () => {
      const a = history.getSnapshot();
      const b = history.getSnapshot();
      expect(a).toBe(b);
    });

    it('getSnapshot returns new reference after push', () => {
      const before = history.getSnapshot();
      history.push({ role: 'user', content: 'hello' });
      const after = history.getSnapshot();

      expect(before).not.toBe(after);
      expect(after).toEqual([{ role: 'user', content: 'hello' }]);
    });

    it('getSnapshot returns new reference after reset', () => {
      history.push({ role: 'user', content: 'hello' });
      const before = history.getSnapshot();
      history.reset();
      const after = history.getSnapshot();

      expect(before).not.toBe(after);
      expect(after).toEqual([]);
    });

    it('push notifies subscribers', () => {
      const listener = vi.fn();
      history.subscribe(listener);
      history.push({ role: 'user', content: 'hello' });

      expect(listener).toHaveBeenCalledOnce();
    });

    it('reset notifies subscribers', () => {
      const listener = vi.fn();
      history.subscribe(listener);
      history.reset();

      expect(listener).toHaveBeenCalledOnce();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsubscribe = history.subscribe(listener);
      unsubscribe();
      history.push({ role: 'user', content: 'hello' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies multiple subscribers independently', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      history.subscribe(listener1);
      const unsubscribe = history.subscribe(listener2);
      history.push({ role: 'user', content: 'hello' });

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();

      unsubscribe();
      history.push({ role: 'assistant', content: 'hi' });

      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledOnce();
    });
  });

  describe('History::Restore', () => {
    const sampleMessages: ChatMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];

    it('replaces an empty history with the given messages', () => {
      history.restore(sampleMessages);

      expect(history.getSnapshot()).toEqual(sampleMessages);
    });

    it('overwrites existing messages entirely (no append, no merge)', () => {
      history.push({ role: 'user', content: 'stale' });
      history.push({ role: 'assistant', content: 'also stale' });

      history.restore(sampleMessages);

      expect(history.getSnapshot()).toEqual(sampleMessages);
    });

    it('restore([]) clears the history', () => {
      history.push({ role: 'user', content: 'hello' });

      history.restore([]);

      expect(history.getSnapshot()).toEqual([]);
    });

    it('defensively copies the input array', () => {
      const input: ChatMessage[] = [{ role: 'user', content: 'hello' }];

      history.restore(input);
      input.push({ role: 'user', content: 'leak' });

      expect(history.getSnapshot()).toEqual([{ role: 'user', content: 'hello' }]);
    });

    it('getSnapshot returns a new reference after restore', () => {
      const before = history.getSnapshot();

      history.restore(sampleMessages);
      const after = history.getSnapshot();

      expect(before).not.toBe(after);
    });

    it('notifies subscribers exactly once per call', () => {
      const listener = vi.fn();
      history.subscribe(listener);

      history.restore(sampleMessages);

      expect(listener).toHaveBeenCalledOnce();
    });

    it('a second restore replaces the previous one (latest call wins)', () => {
      const first: ChatMessage[] = [{ role: 'user', content: 'first' }];
      const second: ChatMessage[] = [{ role: 'user', content: 'second' }];

      history.restore(first);
      history.restore(second);

      expect(history.getSnapshot()).toEqual(second);
    });

    it('allows pushing after restore (continuity with the chat loop)', () => {
      history.restore(sampleMessages);
      const appended: ChatMessage = { role: 'user', content: 'next' };

      history.push(appended);

      expect(history.getSnapshot()).toEqual([...sampleMessages, appended]);
    });
  });
});
