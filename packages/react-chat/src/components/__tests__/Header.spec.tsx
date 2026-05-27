import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';

import { Header } from '../Header';

type HeaderProps = Parameters<typeof Header>[0];

const base: HeaderProps = {
  mode: 'streaming',
  onModeChange: vi.fn(),
  onClearChat: vi.fn(),
  onClose: vi.fn(),
  showModeToggle: false,
  showClearChat: false,
  clearDisabled: false,
};

describe('Header', () => {
  it('renders the title and close button', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<Header {...base} onClose={onClose} />);
    fireEvent.click(getByLabelText('Close chat'));
    expect(onClose).toHaveBeenCalled();
  });

  it('omits the mode toggle when showModeToggle is false', () => {
    const { queryByRole } = render(<Header {...base} showModeToggle={false} />);
    expect(queryByRole('switch')).toBeNull();
  });

  it('switches to synchronous when toggled off from streaming', () => {
    const onModeChange = vi.fn();
    const { getByRole } = render(
      <Header {...base} mode="streaming" onModeChange={onModeChange} showModeToggle={true} />
    );
    const toggle = getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    expect(onModeChange).toHaveBeenCalledWith('synchronous');
  });

  it('switches to streaming when toggled on from synchronous', () => {
    const onModeChange = vi.fn();
    const { getByRole } = render(
      <Header {...base} mode="synchronous" onModeChange={onModeChange} showModeToggle={true} />
    );
    const toggle = getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onModeChange).toHaveBeenCalledWith('streaming');
  });

  it('omits the clear button when showClearChat is false', () => {
    const { queryByLabelText } = render(<Header {...base} showClearChat={false} />);
    expect(queryByLabelText('Clear chat')).toBeNull();
  });

  it('calls onClearChat when the clear button is clicked', () => {
    const onClearChat = vi.fn();
    const { getByLabelText } = render(
      <Header {...base} onClearChat={onClearChat} showClearChat={true} />
    );
    fireEvent.click(getByLabelText('Clear chat'));
    expect(onClearChat).toHaveBeenCalled();
  });

  it('disables the clear button when clearDisabled is true', () => {
    const onClearChat = vi.fn();
    const { getByLabelText } = render(
      <Header {...base} onClearChat={onClearChat} showClearChat={true} clearDisabled={true} />
    );
    const btn = getByLabelText('Clear chat') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClearChat).not.toHaveBeenCalled();
  });
});
