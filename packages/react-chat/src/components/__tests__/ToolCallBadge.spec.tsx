import { fireEvent, render } from '@testing-library/react';

import { ToolCallBadge } from '../ToolCallBadge';

describe('ToolCallBadge', () => {
  const baseCall = { id: 'c1', name: 'get_weather', arguments: { city: 'Berlin' } };

  it('shows running state when no tool message exists', () => {
    const { getByText } = render(<ToolCallBadge call={baseCall} toolMessage={undefined} />);
    expect(getByText('get_weather')).toBeTruthy();
    expect(getByText(/running/i)).toBeTruthy();
  });

  it('shows done state when toolMessage parses without error key', () => {
    const { getByText } = render(
      <ToolCallBadge
        call={baseCall}
        toolMessage={{ role: 'tool', id: 'c1', content: JSON.stringify({ temp: 18 }) }}
      />
    );
    expect(getByText(/done/i)).toBeTruthy();
  });

  it('shows error state when toolMessage parses with error key', () => {
    const { getByText } = render(
      <ToolCallBadge
        call={baseCall}
        toolMessage={{ role: 'tool', id: 'c1', content: JSON.stringify({ error: 'Not found' }) }}
      />
    );
    expect(getByText(/error/i)).toBeTruthy();
  });

  it('expands to reveal args and result on click', () => {
    const { getByRole, queryByText, getByText } = render(
      <ToolCallBadge
        call={baseCall}
        toolMessage={{ role: 'tool', id: 'c1', content: JSON.stringify({ temp: 18 }) }}
      />
    );
    expect(queryByText(/"city"/)).toBeNull();
    fireEvent.click(getByRole('button'));
    expect(getByText(/"city"/)).toBeTruthy();
    expect(getByText(/"temp"/)).toBeTruthy();
  });

  it('falls back to raw content when JSON.parse throws', () => {
    const { getByRole, getByText } = render(
      <ToolCallBadge
        call={baseCall}
        toolMessage={{ role: 'tool', id: 'c1', content: 'not json' }}
      />
    );
    fireEvent.click(getByRole('button'));
    expect(getByText('not json')).toBeTruthy();
  });

  it('renders a string error value verbatim when expanded', () => {
    const { getByRole, getByText } = render(
      <ToolCallBadge
        call={baseCall}
        toolMessage={{ role: 'tool', id: 'c1', content: JSON.stringify({ error: 'Not found' }) }}
      />
    );
    fireEvent.click(getByRole('button'));
    expect(getByText('Not found')).toBeTruthy();
  });

  it('shows args only (no result block) when expanded while still running', () => {
    const { getByRole, getByText, queryByText } = render(
      <ToolCallBadge call={baseCall} toolMessage={undefined} />
    );
    fireEvent.click(getByRole('button'));
    expect(getByText(/"city"/)).toBeTruthy();
    expect(queryByText(/result/i)).toBeNull();
    expect(queryByText(/^error$/)).toBeNull();
  });

  it('stringifies a non-string error value when expanded', () => {
    const { getByRole, getByText } = render(
      <ToolCallBadge
        call={baseCall}
        toolMessage={{
          role: 'tool',
          id: 'c1',
          content: JSON.stringify({ error: { reason: 'rate_limit' } }),
        }}
      />
    );
    fireEvent.click(getByRole('button'));
    expect(getByText(/rate_limit/)).toBeTruthy();
  });
});
