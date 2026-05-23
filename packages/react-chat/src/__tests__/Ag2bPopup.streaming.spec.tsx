import { act, fireEvent, render } from '@testing-library/react';

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
    const { getByLabelText, getByRole, findAllByText } = render(
      <Wrapper>
        <Ag2bPopup mode="streaming" />
      </Wrapper>
    );

    fireEvent.click(getByLabelText('Open chat'));
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hi' } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await Promise.resolve();
    });

    const helloes = await findAllByText('hello');
    expect(helloes.length).toBe(1);
  });
});
