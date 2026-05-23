import { render } from '@testing-library/react';

import { UserMessage } from '../UserMessage';

describe('UserMessage', () => {
  it('renders the user content as markdown', () => {
    const { getByText } = render(<UserMessage content="**hello**" />);
    expect(getByText('hello').tagName).toBe('STRONG');
  });

  it('applies the className override', () => {
    const { container } = render(<UserMessage content="hi" className="x" />);
    expect((container.firstChild as HTMLElement).className).toContain('x');
  });
});
