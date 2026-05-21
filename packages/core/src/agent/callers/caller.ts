import type { ProviderRequest, ProviderResponse } from '@/provider';

/** Strategy for calling the provider. Returns a normalized result. */
export type ProviderCaller = (
  request: ProviderRequest,
  signal?: AbortSignal
) => Promise<ProviderResponse>;
