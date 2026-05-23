import type { AssistantMessage as AMsg, ToolMessage } from '@ag2b/core';
import { render } from '@testing-library/react';

import { AssistantMessage } from '../AssistantMessage';

describe('AssistantMessage', () => {
  const assistantWithCalls: AMsg = {
    role: 'assistant',
    content: 'sure',
    calls: [{ id: 'c1', name: 'get_weather', arguments: { city: 'B' } }],
  };

  it('renders content as markdown', () => {
    const { getByText } = render(
      <AssistantMessage
        message={{ role: 'assistant', content: '**hi**' }}
        toolMessages={[]}
        pending={false}
        showReasoning={false}
      />
    );
    expect(getByText('hi').tagName).toBe('STRONG');
  });

  it('renders one badge per call, paired by id', () => {
    const tool: ToolMessage = { role: 'tool', id: 'c1', content: JSON.stringify({ temp: 18 }) };
    const { getByText } = render(
      <AssistantMessage
        message={assistantWithCalls}
        toolMessages={[tool]}
        pending={false}
        showReasoning={false}
      />
    );
    expect(getByText('get_weather')).toBeTruthy();
    expect(getByText(/done/i)).toBeTruthy();
  });

  it('renders Reasoning when showReasoning=true and message.reasoning is set', () => {
    const { getByText } = render(
      <AssistantMessage
        message={{ role: 'assistant', reasoning: 'thinking…', content: 'done' }}
        toolMessages={[]}
        pending={false}
        showReasoning={true}
      />
    );
    expect(getByText('Thinking')).toBeTruthy();
  });

  it('does not render Reasoning when showReasoning=false even if message.reasoning is set', () => {
    const { queryByText } = render(
      <AssistantMessage
        message={{ role: 'assistant', reasoning: 'thinking…', content: 'done' }}
        toolMessages={[]}
        pending={false}
        showReasoning={false}
      />
    );
    expect(queryByText('Thinking')).toBeNull();
  });
});
