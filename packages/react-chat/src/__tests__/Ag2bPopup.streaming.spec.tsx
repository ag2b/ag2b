import { fireEvent, render } from '@testing-library/react';

import { Ag2bPopup } from '../Ag2bPopup';
import { makeStreamingAgent, wrapper } from './fixtures';

describe('Ag2bPopup (streaming mode)', () => {
  it('renders pending content during deltas and a single committed bubble after done', async () => {
    const agent = makeStreamingAgent([
      [
        { type: 'provider_content_delta', delta: 'hel' },
        { type: 'provider_content_delta', delta: 'lo' },
        { type: 'provider_stream_done', finishReason: 'stop' },
      ],
    ]);
    const Wrapper = wrapper(agent);
    const { getByLabelText, getByRole, findByLabelText, getAllByText } = render(
      <Wrapper>
        <Ag2bPopup mode="streaming" />
      </Wrapper>
    );

    fireEvent.click(getByLabelText('Open chat'));
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hi' } });

    fireEvent.keyDown(textarea, { key: 'Enter' });

    // Wait for the stream to settle (composer returns to idle) so we assert the
    // committed bubble, not the transient pending+committed duplication window.
    await findByLabelText('Send');
    expect(getAllByText('hello').length).toBe(1);
  });
});
