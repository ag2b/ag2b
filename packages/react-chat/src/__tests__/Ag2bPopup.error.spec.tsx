import type { ProviderRequest, ProviderResponse } from '@ag2b/core';
import { AbstractProvider, createAgent } from '@ag2b/core';
import { Ag2bProvider } from '@ag2b/react';
import { fireEvent, render } from '@testing-library/react';

import { Ag2bPopup } from '../Ag2bPopup';

class ThrowingProvider extends AbstractProvider {
  constructor() {
    super({ baseURL: '/x' });
  }
  protected runChat(): Promise<ProviderResponse> {
    throw new Error('boom');
  }
  override chat(_req: ProviderRequest): Promise<ProviderResponse> {
    return Promise.reject(new Error('boom'));
  }
}

describe('Ag2bPopup (error)', () => {
  it('shows the error banner when the provider throws', async () => {
    const agent = createAgent({ provider: new ThrowingProvider() });
    const { getByLabelText, getByRole, findByRole } = render(
      <Ag2bProvider agent={agent}>
        <Ag2bPopup mode="synchronous" />
      </Ag2bProvider>
    );

    fireEvent.click(getByLabelText('Open chat'));
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hi' } });

    fireEvent.keyDown(textarea, { key: 'Enter' });

    const alert = await findByRole('alert');
    expect(alert.textContent).toMatch(/boom/);
  });
});
