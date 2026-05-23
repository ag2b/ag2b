import { fireEvent, render } from '@testing-library/react';

import { Reasoning } from '../Reasoning';

describe('Reasoning', () => {
  it('is collapsed by default when not pending', () => {
    const { getByRole, queryByText } = render(<Reasoning text="thinking…" pending={false} />);
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('false');
    expect(queryByText('thinking…')).toBeNull();
  });

  it('is expanded by default when pending', () => {
    const { getByRole, getByText } = render(<Reasoning text="thinking…" pending={true} />);
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(getByText('thinking…')).toBeTruthy();
  });

  it('respects user click after pending transitions to false', () => {
    const { getByRole, rerender, getByText } = render(<Reasoning text="t" pending={true} />);
    fireEvent.click(getByRole('button'));
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('false');

    rerender(<Reasoning text="t" pending={false} />);
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(getByRole('button'));
    expect(getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(getByText('t')).toBeTruthy();
  });
});
