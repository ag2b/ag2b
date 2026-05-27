import { afterEach, describe, expect, it, vi } from 'vitest';

import { authFetch } from '../authFetch';

const ENDPOINT = 'https://example.com/v1';
const ORIGINAL_FETCH = globalThis.fetch;

function captureFetch() {
  const spy = vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}', { status: 200 })));
  globalThis.fetch = spy;
  return spy;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

function headersFromCall(spy: ReturnType<typeof captureFetch>): Headers {
  const init = spy.mock.calls[0]?.[1];
  return new Headers(init?.headers);
}

const BASE_INIT: RequestInit = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
};

describe('authFetch', () => {
  describe('openai', () => {
    it('adds Authorization: Bearer when apiKey present', async () => {
      const spy = captureFetch();
      const fetcher = authFetch({ provider: 'openai', baseURL: ENDPOINT, apiKey: 'sk-test' });
      await fetcher(ENDPOINT, BASE_INIT);
      expect(headersFromCall(spy).get('Authorization')).toBe('Bearer sk-test');
    });

    it('omits Authorization when apiKey is empty', async () => {
      const spy = captureFetch();
      const fetcher = authFetch({ provider: 'openai', baseURL: ENDPOINT });
      await fetcher(ENDPOINT, BASE_INIT);
      expect(headersFromCall(spy).get('Authorization')).toBeNull();
    });

    it('preserves caller headers', async () => {
      const spy = captureFetch();
      const fetcher = authFetch({ provider: 'openai', baseURL: ENDPOINT, apiKey: 'sk-test' });
      await fetcher(ENDPOINT, BASE_INIT);
      expect(headersFromCall(spy).get('Content-Type')).toBe('application/json');
    });
  });

  describe('anthropic', () => {
    it('always adds anthropic-version and browser-access headers', async () => {
      const spy = captureFetch();
      const fetcher = authFetch({ provider: 'anthropic', baseURL: ENDPOINT });
      await fetcher(ENDPOINT, BASE_INIT);
      const headers = headersFromCall(spy);
      expect(headers.get('anthropic-version')).toBe('2023-06-01');
      expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    });

    it('adds x-api-key when apiKey present', async () => {
      const spy = captureFetch();
      const fetcher = authFetch({ provider: 'anthropic', baseURL: ENDPOINT, apiKey: 'sk-ant' });
      await fetcher(ENDPOINT, BASE_INIT);
      expect(headersFromCall(spy).get('x-api-key')).toBe('sk-ant');
    });

    it('omits x-api-key when apiKey absent', async () => {
      const spy = captureFetch();
      const fetcher = authFetch({ provider: 'anthropic', baseURL: ENDPOINT });
      await fetcher(ENDPOINT, BASE_INIT);
      expect(headersFromCall(spy).get('x-api-key')).toBeNull();
    });
  });
});
