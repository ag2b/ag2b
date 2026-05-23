import { act, render } from '@testing-library/react';
import { useRef } from 'react';

import { useAutoScroll } from '../useAutoScroll';

const Harness = ({ contentHeight }: { contentHeight: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  useAutoScroll(ref, [contentHeight]);
  return (
    <div ref={ref} data-testid="scroll" style={{ height: 100, overflow: 'auto' }}>
      <div style={{ height: contentHeight }} />
    </div>
  );
};

describe('useAutoScroll', () => {
  it('pins to bottom when content grows and user is at bottom', () => {
    const { rerender, getByTestId } = render(<Harness contentHeight={200} />);
    const el = getByTestId('scroll');
    Object.defineProperty(el, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });
    el.scrollTop = 100;

    Object.defineProperty(el, 'scrollHeight', { value: 400, configurable: true });
    rerender(<Harness contentHeight={400} />);

    expect(el.scrollTop).toBe(el.scrollHeight - el.clientHeight);
  });

  it('does not yank when user has scrolled up', () => {
    const { rerender, getByTestId } = render(<Harness contentHeight={200} />);
    const el = getByTestId('scroll');
    Object.defineProperty(el, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });
    el.scrollTop = 100;

    act(() => {
      el.scrollTop = 20;
      el.dispatchEvent(new Event('scroll'));
    });

    rerender(<Harness contentHeight={400} />);
    Object.defineProperty(el, 'scrollHeight', { value: 400, configurable: true });

    expect(el.scrollTop).toBe(20);
  });
});
