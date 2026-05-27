import { fireEvent, render } from '@testing-library/react';

import { Ag2bPopup } from '../Ag2bPopup';
import { makeAgent, wrapper } from './fixtures';

describe('Ag2bPopup (open/close)', () => {
  it('FAB toggles the panel; aria-expanded reflects state', () => {
    const Wrapper = wrapper(makeAgent());
    const { getByLabelText, getAllByLabelText, queryByRole } = render(
      <Wrapper>
        <Ag2bPopup />
      </Wrapper>
    );

    const fab = getByLabelText('Open chat');
    expect(fab.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('dialog')).toBeNull();

    fireEvent.click(fab);
    expect(queryByRole('dialog')).not.toBeNull();
    // Two elements share "Close chat": the FAB (has aria-expanded) and the Header close button.
    const closeButtons = getAllByLabelText('Close chat');
    const fabClose = closeButtons.find((el) => el.hasAttribute('aria-expanded'));
    expect(fabClose?.getAttribute('aria-expanded')).toBe('true');
  });

  it('Esc does not close the panel (agent-triggered overlays own Escape)', () => {
    const Wrapper = wrapper(makeAgent());
    const { getByLabelText, queryByRole } = render(
      <Wrapper>
        <Ag2bPopup />
      </Wrapper>
    );
    fireEvent.click(getByLabelText('Open chat'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(queryByRole('dialog')).not.toBeNull();
  });

  it('click outside does not close the panel', () => {
    const Wrapper = wrapper(makeAgent());
    const { getByLabelText, queryByRole, baseElement } = render(
      <Wrapper>
        <div data-testid="outside">elsewhere</div>
        <Ag2bPopup />
      </Wrapper>
    );
    fireEvent.click(getByLabelText('Open chat'));
    expect(queryByRole('dialog')).not.toBeNull();
    const outside = baseElement.querySelector('[data-testid="outside"]');
    if (!outside) throw new Error('outside element not found');
    fireEvent.mouseDown(outside);
    expect(queryByRole('dialog')).not.toBeNull();
  });

  it('header close button closes the panel', () => {
    const Wrapper = wrapper(makeAgent());
    const { getByLabelText, getAllByLabelText, queryByRole } = render(
      <Wrapper>
        <Ag2bPopup />
      </Wrapper>
    );
    fireEvent.click(getByLabelText('Open chat'));
    expect(queryByRole('dialog')).not.toBeNull();
    // The header close button is the "Close chat" control without aria-expanded (the FAB has it).
    const headerClose = getAllByLabelText('Close chat').find(
      (el) => !el.hasAttribute('aria-expanded')
    );
    if (!headerClose) throw new Error('header close button not found');
    fireEvent.click(headerClose);
    expect(queryByRole('dialog')).toBeNull();
  });
});
