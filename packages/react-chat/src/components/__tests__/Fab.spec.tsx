import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';

import { Fab } from '../Fab';

describe('Fab', () => {
  it('renders with aria-label and triggers onClick', () => {
    const onClick = vi.fn();
    const { getByLabelText } = render(
      <Fab placement="bottom-right" open={false} onClick={onClick} panelId="p1" />
    );
    fireEvent.click(getByLabelText(/chat/i));
    expect(onClick).toHaveBeenCalled();
  });

  it('reflects open state in aria-expanded', () => {
    const { getByLabelText, rerender } = render(
      <Fab placement="bottom-right" open={false} onClick={vi.fn()} panelId="p1" />
    );
    expect(getByLabelText(/chat/i).getAttribute('aria-expanded')).toBe('false');
    rerender(<Fab placement="bottom-right" open={true} onClick={vi.fn()} panelId="p1" />);
    expect(getByLabelText(/chat/i).getAttribute('aria-expanded')).toBe('true');
  });
});
