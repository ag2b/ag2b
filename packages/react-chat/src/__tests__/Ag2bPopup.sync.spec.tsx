import { fireEvent, render } from '@testing-library/react';

import { Ag2bPopup } from '../Ag2bPopup';
import { makeAgent, wrapper } from './fixtures';

describe('Ag2bPopup (synchronous mode)', () => {
  it('sends a message and renders the assistant turn from history', async () => {
    const agent = makeAgent([{ content: 'hello there', finishReason: 'stop' }]);
    const Wrapper = wrapper(agent);
    const { getByLabelText, getByRole, findByText } = render(
      <Wrapper>
        <Ag2bPopup mode="synchronous" />
      </Wrapper>
    );

    fireEvent.click(getByLabelText('Open chat'));
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hi' } });

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(await findByText('hi')).toBeTruthy();
    expect(await findByText('hello there')).toBeTruthy();
  });
});
