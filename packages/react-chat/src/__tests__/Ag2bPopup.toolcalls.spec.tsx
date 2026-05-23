import { Scope, Tool } from '@ag2b/core';
import { act, fireEvent, render } from '@testing-library/react';
import z from 'zod/v4';

import { Ag2bPopup } from '../Ag2bPopup';
import { makeAgent, wrapper } from './fixtures';

describe('Ag2bPopup (tool calls)', () => {
  it('renders a tool-call badge and the final assistant message', async () => {
    const agent = makeAgent([
      {
        content: '',
        calls: [{ id: 'c1', name: 'echo', arguments: { msg: 'hi' } }],
        finishReason: 'tool_calls',
      },
      { content: 'sure: hi', finishReason: 'stop' },
    ]);

    agent.scopes.register(
      new Scope({
        name: 'demo',
        tools: [
          new Tool({
            name: 'echo',
            description: 'echo input',
            parameters: z.object({ msg: z.string() }),
            handler: ({ msg }) => ({ msg }),
          }),
        ],
      })
    );

    const Wrapper = wrapper(agent);
    const { getByLabelText, getByRole, findByText } = render(
      <Wrapper>
        <Ag2bPopup mode="synchronous" />
      </Wrapper>
    );

    fireEvent.click(getByLabelText('Open chat'));
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'go' } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await Promise.resolve();
    });

    expect(await findByText('echo')).toBeTruthy();
    expect(await findByText(/done/i)).toBeTruthy();
    expect(await findByText('sure: hi')).toBeTruthy();
  });
});
