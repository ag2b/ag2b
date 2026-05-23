import type { AssistantMessage, ChatMessage } from '@ag2b/core';
import { render } from '@testing-library/react';

import { MessageList } from '../MessageList';

const u = (content: string): ChatMessage => ({ role: 'user', content });
const a = (content: string): ChatMessage => ({ role: 'assistant', content });

describe('MessageList', () => {
  it('renders user and assistant messages in order', () => {
    const { container } = render(
      <MessageList
        messages={[u('hi'), a('hello'), u('bye')]}
        pendingMessage={null}
        showReasoning={false}
      />
    );
    const bubbles = Array.from(container.querySelectorAll('p')).map((p) => p.textContent);
    expect(bubbles).toEqual(['hi', 'hello', 'bye']);
  });

  it('skips tool messages at top level (they pair into the assistant turn)', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'sure',
        calls: [{ id: 'c1', name: 't', arguments: {} }],
      },
      { role: 'tool', id: 'c1', content: JSON.stringify({ ok: true }) },
    ];
    const { getByText, container } = render(
      <MessageList messages={messages} pendingMessage={null} showReasoning={false} />
    );
    expect(getByText('t')).toBeTruthy();
    expect(container.textContent).toContain('done');
  });

  it('renders pendingMessage after committed history', () => {
    const pending: AssistantMessage = { role: 'assistant', content: 'streaming…' };
    const { container } = render(
      <MessageList messages={[u('hi')]} pendingMessage={pending} showReasoning={false} />
    );
    const bubbles = Array.from(container.querySelectorAll('p')).map((p) => p.textContent);
    expect(bubbles).toEqual(['hi', 'streaming…']);
  });
});
