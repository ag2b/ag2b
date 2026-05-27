import type { ModelSettings } from '../domain/model-settings';

const ANTHROPIC_VERSION = '2023-06-01';

export function authFetch(settings: ModelSettings): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);

    if (settings.provider === 'anthropic') {
      headers.set('anthropic-version', ANTHROPIC_VERSION);
      headers.set('anthropic-dangerous-direct-browser-access', 'true');
      if (settings.apiKey) headers.set('x-api-key', settings.apiKey);
    } else {
      if (settings.apiKey) headers.set('Authorization', `Bearer ${settings.apiKey}`);
    }

    return globalThis.fetch(input, { ...init, headers });
  };
}
