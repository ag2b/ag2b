import { render } from '@testing-library/react';

import { ErrorBanner } from '../ErrorBanner';

describe('ErrorBanner', () => {
  it('renders nothing when error is undefined', () => {
    const { container } = render(<ErrorBanner error={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders error.message with role="alert"', () => {
    const { getByRole, getByText } = render(<ErrorBanner error={new Error('boom')} />);
    expect(getByRole('alert')).toBeTruthy();
    expect(getByText(/boom/)).toBeTruthy();
  });

  it('renders string errors as-is', () => {
    const { getByText } = render(<ErrorBanner error="rate limited" />);
    expect(getByText(/rate limited/)).toBeTruthy();
  });

  it('falls back to JSON.stringify for object errors', () => {
    const { getByText } = render(<ErrorBanner error={{ code: 'E_FOO' }} />);
    expect(getByText(/E_FOO/)).toBeTruthy();
  });

  it('falls back to String() when JSON.stringify throws', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const { getByRole } = render(<ErrorBanner error={circular} />);
    expect(getByRole('alert').textContent).toContain('[object Object]');
  });
});
