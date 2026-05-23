import { render } from '@testing-library/react';

import { LogoMark } from '../LogoMark';

describe('LogoMark', () => {
  it('renders an SVG with the given size', () => {
    const { container } = render(<LogoMark size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });

  it('defaults to size 22', () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('22');
  });

  it('applies the cursor accent via inline style', () => {
    const { container } = render(<LogoMark />);
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('style') ?? '').toContain('var(--ag2b-accent)');
  });

  it('omits the blink animation when blink=false', () => {
    const { container } = render(<LogoMark blink={false} />);
    expect(container.querySelector('animate')).toBeNull();
  });
});
