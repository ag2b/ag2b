import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';

import { Header } from '../Header';

describe('Header', () => {
  it('renders the title and close button', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <Header mode="streaming" onModeChange={vi.fn()} onClose={onClose} showModeToggle={false} />
    );
    fireEvent.click(getByLabelText('Close chat'));
    expect(onClose).toHaveBeenCalled();
  });

  it('omits the toggle when showModeToggle is false', () => {
    const { queryByLabelText } = render(
      <Header mode="streaming" onModeChange={vi.fn()} onClose={vi.fn()} showModeToggle={false} />
    );
    expect(queryByLabelText(/mode/i)).toBeNull();
  });

  it('calls onModeChange when toggle clicked', () => {
    const onModeChange = vi.fn();
    const { getByLabelText } = render(
      <Header
        mode="streaming"
        onModeChange={onModeChange}
        onClose={vi.fn()}
        showModeToggle={true}
      />
    );
    fireEvent.click(getByLabelText(/mode/i));
    expect(onModeChange).toHaveBeenCalledWith('synchronous');
  });

  it('toggles back to streaming when starting in synchronous', () => {
    const onModeChange = vi.fn();
    const { getByLabelText } = render(
      <Header
        mode="synchronous"
        onModeChange={onModeChange}
        onClose={vi.fn()}
        showModeToggle={true}
      />
    );
    fireEvent.click(getByLabelText(/mode/i));
    expect(onModeChange).toHaveBeenCalledWith('streaming');
  });
});
