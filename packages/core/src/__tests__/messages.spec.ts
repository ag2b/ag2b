import { assistantMessage, toolMessage, userMessage } from '@/messages';

describe('Messages', () => {
  describe('Messages:UserMessage', () => {
    it('should create user message', () => {
      const message = userMessage('user message');

      expect(message).toEqual({ role: 'user', content: 'user message' });
    });
  });

  describe('Messages::AssistantMessage', () => {
    it('should create assistant message without tools', () => {
      const message = assistantMessage({ content: 'assistant message' });

      expect(message).toEqual({
        role: 'assistant',
        content: 'assistant message',
      });
    });

    it('should create assistant message with tool calls and content', () => {
      const message = assistantMessage({
        content: 'assistant message',
        calls: [{ id: '1', name: 'tool', arguments: { a: 1 } }],
      });

      expect(message).toEqual({
        role: 'assistant',
        content: 'assistant message',
        calls: [{ id: '1', name: 'tool', arguments: { a: 1 } }],
      });
    });

    it('should create assistant message with tool calls only (no content)', () => {
      const message = assistantMessage({ calls: [{ id: '1', name: 'tool', arguments: {} }] });

      expect(message).toEqual({
        role: 'assistant',
        calls: [{ id: '1', name: 'tool', arguments: {} }],
      });
    });

    it('should create assistant message with no arguments', () => {
      const message = assistantMessage({});

      expect(message).toEqual({
        role: 'assistant',
      });
    });

    it('should preserve whitespace in assistant content verbatim', () => {
      const message = assistantMessage({ content: '  hello world  ' });

      // Don't trim — history content must match what was streamed so chat UIs can
      // hand off from the streaming bubble to the history bubble without a rewrite.
      expect(message.content).toBe('  hello world  ');
    });

    it('should normalize empty string content to undefined', () => {
      const message = assistantMessage({ content: '' });

      expect(message.content).toBeUndefined();
    });

    it('should normalize whitespace-only content to undefined', () => {
      const message = assistantMessage({ content: '\n\n' });

      expect(message.content).toBeUndefined();
    });

    it('should normalize spaces-only content to undefined', () => {
      const message = assistantMessage({ content: '   ' });

      expect(message.content).toBeUndefined();
    });

    describe('Messages::AssistantMessage::Reasoning', () => {
      it('stores reasoning when provided', () => {
        const msg = assistantMessage({ content: 'hello', reasoning: 'step-by-step thought' });
        expect(msg.reasoning).toBe('step-by-step thought');
      });

      it('normalizes whitespace-only reasoning to undefined', () => {
        const msg = assistantMessage({ content: 'hello', reasoning: '   \n  ' });
        expect(msg.reasoning).toBeUndefined();
      });

      it('preserves reasoning with meaningful whitespace verbatim', () => {
        const msg = assistantMessage({ content: 'hello', reasoning: '\n  thinking:\n  step 1\n' });
        expect(msg.reasoning).toBe('\n  thinking:\n  step 1\n');
      });

      it('defaults reasoning to undefined when omitted', () => {
        const msg = assistantMessage({ content: 'hello' });
        expect(msg.reasoning).toBeUndefined();
      });

      it('stores metadata when provided', () => {
        const msg = assistantMessage({
          reasoning: 'thinking',
          metadata: { reasoningSignature: 'base64-sig-opaque' },
        });
        expect(msg.metadata?.reasoningSignature).toBe('base64-sig-opaque');
      });

      it('defaults metadata to undefined when omitted', () => {
        const msg = assistantMessage({ content: 'hello', reasoning: 'thinking' });
        expect(msg.metadata).toBeUndefined();
      });

      it('tool-call-only turn can carry reasoning', () => {
        const msg = assistantMessage({
          calls: [{ id: 'c1', name: 'x', arguments: {} }],
          reasoning: 'why I call x',
        });
        expect(msg.content).toBeUndefined();
        expect(msg.reasoning).toBe('why I call x');
        expect(msg.calls).toHaveLength(1);
      });
    });
  });

  describe('Messages::ToolMessage', () => {
    it('should create tool message', () => {
      const message = toolMessage('1', 'tool message');

      expect(message).toEqual({ role: 'tool', id: '1', content: 'tool message' });
    });
  });
});
