import { Scope, Tool } from '@ag2b/core';
import { act, fireEvent, render } from '@testing-library/react';
import z from 'zod/v4';

import { Ag2bPopup } from '../Ag2bPopup';
import { makeAgent, makeStreamingAgent, wrapper } from './fixtures';

describe('Ag2bPopup (tool calls)', () => {
  it('shows the tool-call badge from the in-flight stream before it commits', async () => {
    const agent = makeStreamingAgent();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.spyOn(agent, 'chatStream').mockImplementation(async function* () {
      yield { type: 'agent_chat_start', message: 'go' };
      yield {
        type: 'agent_tool_call_delta',
        index: 0,
        id: 'c1',
        name: 'echo',
        argumentsDelta: '{"x":1}',
      };
      await gate;
      yield { type: 'agent_content_end' };
      yield { type: 'agent_chat_done', response: { finishReason: 'tool_calls' } };
    });

    const Wrapper = wrapper(agent);
    const { getByLabelText, getByRole, findByText } = render(
      <Wrapper>
        <Ag2bPopup mode="streaming" />
      </Wrapper>
    );

    fireEvent.click(getByLabelText('Open chat'));
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'go' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // The stream stays gated open after the tool-call delta; `findByText` polls
    // until the badge renders — proving it's visible before the assistant message
    // (and its calls) commits to history.
    expect(await findByText('echo')).toBeTruthy();

    await act(async () => {
      release();
      await Promise.resolve();
    });
  });

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
