import type { ChatMessage } from '@/messages';
import type { ScopeContext } from '@/scope';

import { inlineScopeContexts } from '../context-injection';

const ctx = (
  label: string,
  content: string,
  injection: 'system' | 'user' = 'system'
): ScopeContext => ({ label, injection, content });

describe('inlineScopeContexts', () => {
  describe('inlineScopeContexts::no-op cases', () => {
    it('returns input unchanged when contexts is empty (with system)', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([], messages, 'sys');

      expect(result.messages).toBe(messages);
      expect(result.system).toBe('sys');
    });

    it('returns input unchanged when contexts is empty (no system)', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([], messages);

      expect(result.messages).toBe(messages);
      expect(result.system).toBeUndefined();
    });

    it('leaves messages unchanged when only system contexts are provided', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'system')], messages, 'sys');

      expect(result.messages).toBe(messages);
    });

    it('leaves system unchanged when only user contexts are provided', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'user')], messages, 'sys');

      expect(result.system).toBe('sys');
    });
  });

  describe('inlineScopeContexts::system injection', () => {
    it('appends a single system context to the base system prompt', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'system')], messages, 'sys');

      expect(result.system).toBe('sys\n\n## a\nx');
    });

    it('returns rendered context when no base system prompt is given', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'system')], messages);

      expect(result.system).toBe('## a\nx');
    });

    it('joins multiple system contexts with double newlines, in order', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts(
        [ctx('a', 'x', 'system'), ctx('b', 'y', 'system')],
        messages,
        'sys'
      );

      expect(result.system).toBe('sys\n\n## a\nx\n\n## b\ny');
    });

    it('preserves base system when no system contexts are provided', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'user')], messages, 'sys');

      expect(result.system).toBe('sys');
    });
  });

  describe('inlineScopeContexts::user injection', () => {
    it('appends a single user context to the last user message', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'user')], messages);

      expect(result.messages).toEqual([{ role: 'user', content: 'hi\n\n## a\nx' }]);
    });

    it('uses rendered text alone when last user content is empty', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: '' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'user')], messages);

      expect(result.messages).toEqual([{ role: 'user', content: '## a\nx' }]);
    });

    it('joins multiple user contexts into the last user message, in order', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'user'), ctx('b', 'y', 'user')], messages);

      expect(result.messages).toEqual([{ role: 'user', content: 'hi\n\n## a\nx\n\n## b\ny' }]);
    });

    it('appends to the LAST user message when multiple user messages exist', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
      ];
      const result = inlineScopeContexts([ctx('a', 'x', 'user')], messages);

      expect(result.messages).toEqual([
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second\n\n## a\nx' },
      ]);
    });

    it('skips trailing non-user messages when locating the last user message', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'reply' },
        { role: 'tool', id: 't1', content: '{}' },
      ];
      const result = inlineScopeContexts([ctx('a', 'x', 'user')], messages);

      expect(result.messages).toEqual([
        { role: 'user', content: 'hi\n\n## a\nx' },
        { role: 'assistant', content: 'reply' },
        { role: 'tool', id: 't1', content: '{}' },
      ]);
    });

    it('returns the same messages reference when no user message exists', () => {
      const messages: ChatMessage[] = [{ role: 'assistant', content: 'only assistant' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'user')], messages);

      expect(result.messages).toBe(messages);
    });
  });

  describe('inlineScopeContexts::mixed injection', () => {
    it('routes contexts to messages and system independently by strategy', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts(
        [ctx('s', 'sx', 'system'), ctx('u', 'ux', 'user')],
        messages,
        'sys'
      );

      expect(result.system).toBe('sys\n\n## s\nsx');
      expect(result.messages).toEqual([{ role: 'user', content: 'hi\n\n## u\nux' }]);
    });

    it('preserves order within each injection bucket', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts(
        [
          ctx('s1', 'a', 'system'),
          ctx('u1', 'b', 'user'),
          ctx('s2', 'c', 'system'),
          ctx('u2', 'd', 'user'),
        ],
        messages
      );

      expect(result.system).toBe('## s1\na\n\n## s2\nc');
      expect(result.messages).toEqual([{ role: 'user', content: 'hi\n\n## u1\nb\n\n## u2\nd' }]);
    });
  });

  describe('inlineScopeContexts::purity', () => {
    it('does not mutate the input messages array', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const snapshot = structuredClone(messages);

      inlineScopeContexts([ctx('a', 'x', 'user')], messages, 'sys');

      expect(messages).toEqual(snapshot);
    });

    it('does not mutate the input contexts array', () => {
      const contexts = [ctx('a', 'x', 'system')];
      const snapshot = structuredClone(contexts);

      inlineScopeContexts(contexts, [{ role: 'user', content: 'hi' }], 'sys');

      expect(contexts).toEqual(snapshot);
    });

    it('returns the same messages reference when only system injection occurs', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts([ctx('a', 'x', 'system')], messages, 'sys');

      expect(result.messages).toBe(messages);
    });
  });

  describe('inlineScopeContexts::content serialization', () => {
    it('passes string content through verbatim (no extra quoting)', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts(
        [{ label: 'a', injection: 'system', content: 'plain text' }],
        messages
      );

      expect(result.system).toBe('## a\nplain text');
    });

    it('JSON-stringifies non-string content', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts(
        [{ label: 'a', injection: 'system', content: { items: [1, 2, 3] } }],
        messages
      );

      expect(result.system).toBe('## a\n{"items":[1,2,3]}');
    });

    it('skips a context whose content cannot be JSON-stringified (circular ref)', () => {
      const circular: { self?: unknown } = {};
      circular.self = circular;

      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts(
        [
          { label: 'bad', injection: 'system', content: circular },
          { label: 'good', injection: 'system', content: { ok: true } },
        ],
        messages
      );

      // 'bad' is silently skipped, 'good' renders normally
      expect(result.system).toBe('## good\n{"ok":true}');
    });

    it('handles primitive non-string content (numbers, booleans, null)', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
      const result = inlineScopeContexts(
        [
          { label: 'n', injection: 'system', content: 42 },
          { label: 'b', injection: 'system', content: true },
          { label: 'z', injection: 'system', content: null },
        ],
        messages
      );

      expect(result.system).toBe('## n\n42\n\n## b\ntrue\n\n## z\nnull');
    });
  });
});
