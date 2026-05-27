import type { ChatMessage } from '@ag2b/core';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

import { Panel } from '../Panel';

const baseProps = {
  panelId: 'p1',
  placement: 'bottom-right' as const,
  mode: 'streaming' as const,
  showModeToggle: false,
  showClearChat: false,
  showReasoning: false,
  onModeChange: vi.fn(),
  onClearChat: vi.fn(),
  onClose: vi.fn(),
  onSend: vi.fn(),
  onAbort: vi.fn(),
  isPending: false,
  error: undefined as unknown,
  messages: [] as ChatMessage[],
  pendingMessage: null,
};

describe('Panel', () => {
  it('renders an empty message list, header, composer', () => {
    const { getByLabelText, getByRole } = render(<Panel {...baseProps} />);
    expect(getByLabelText('Close chat')).toBeTruthy();
    expect(getByRole('textbox')).toBeTruthy();
  });

  it('shows the ErrorBanner when error is set', () => {
    const { getByRole } = render(<Panel {...baseProps} error="boom" />);
    expect(getByRole('alert')).toBeTruthy();
  });

  it('has role=dialog and aria-modal=false', () => {
    const { getByRole } = render(<Panel {...baseProps} />);
    const dialog = getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('false');
    expect(dialog.id).toBe('p1');
  });
});
