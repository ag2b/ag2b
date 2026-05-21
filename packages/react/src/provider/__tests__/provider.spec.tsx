import { render, renderHook } from '@testing-library/react';
import type { FC, PropsWithChildren } from 'react';

import { Ag2bProvider, useAg2bContext } from '@/provider';

import { makeAgent, wrapper } from '../../__tests__/fixtures';

describe('Ag2bProvider', () => {
  it('renders children unchanged', () => {
    const agent = makeAgent();
    const { getByTestId } = render(
      <Ag2bProvider agent={agent}>
        <span data-testid="child">hello</span>
      </Ag2bProvider>
    );
    expect(getByTestId('child').textContent).toBe('hello');
  });

  it('exposes the agent to consumers via useAg2bContext', () => {
    const agent = makeAgent();
    const { result } = renderHook(() => useAg2bContext(), { wrapper: wrapper(agent) });
    expect(result.current).toBe(agent);
  });

  it('throws ContextError when used outside a Provider', () => {
    expect(() => renderHook(() => useAg2bContext())).toThrow(/Provider/);
  });

  it('inner Provider wins for nested providers', () => {
    const outer = makeAgent();
    const inner = makeAgent();
    const Wrapper: FC<PropsWithChildren> = ({ children }) => (
      <Ag2bProvider agent={outer}>
        <Ag2bProvider agent={inner}>{children}</Ag2bProvider>
      </Ag2bProvider>
    );
    const { result } = renderHook(() => useAg2bContext(), { wrapper: Wrapper });
    expect(result.current).toBe(inner);
  });

  it('propagates a new agent prop on re-render', () => {
    const first = makeAgent();
    const second = makeAgent();

    let captured: ReturnType<typeof useAg2bContext> | undefined;
    const Probe: FC = () => {
      captured = useAg2bContext();
      return null;
    };

    const { rerender } = render(
      <Ag2bProvider agent={first}>
        <Probe />
      </Ag2bProvider>
    );
    expect(captured).toBe(first);

    rerender(
      <Ag2bProvider agent={second}>
        <Probe />
      </Ag2bProvider>
    );
    expect(captured).toBe(second);
  });
});
