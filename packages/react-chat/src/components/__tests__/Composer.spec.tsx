import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';

import { Composer } from '../Composer';

describe('Composer', () => {
  it('calls onSend with current value when Enter is pressed', () => {
    const onSend = vi.fn();
    const { getByRole } = render(<Composer onSend={onSend} onAbort={vi.fn()} isPending={false} />);
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('inserts newline on Shift+Enter without sending', () => {
    const onSend = vi.fn();
    const { getByRole } = render(<Composer onSend={onSend} onAbort={vi.fn()} isPending={false} />);
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send empty/whitespace-only values', () => {
    const onSend = vi.fn();
    const { getByRole } = render(<Composer onSend={onSend} onAbort={vi.fn()} isPending={false} />);
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables the textarea while pending and swaps Send to Stop', () => {
    const onAbort = vi.fn();
    const { getByRole, getByLabelText } = render(
      <Composer onSend={vi.fn()} onAbort={onAbort} isPending={true} />
    );
    expect((getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(getByLabelText('Stop'));
    expect(onAbort).toHaveBeenCalled();
  });

  it('clears the textarea after a successful send', () => {
    const { getByRole } = render(<Composer onSend={vi.fn()} onAbort={vi.fn()} isPending={false} />);
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('');
  });
});
