import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ProviderKind = 'openai' | 'anthropic';

export type ModelSettings = {
  provider: ProviderKind;
  baseURL: string;
  apiKey?: string;
  model?: string;
};

export const PROVIDER_DEFAULTS: Record<
  ProviderKind,
  { label: string; baseURL: string; defaultModel: string }
> = {
  openai: {
    label: 'OpenAI-compatible',
    baseURL: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    label: 'Anthropic-compatible',
    baseURL: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-6',
  },
};

type ModelSettingsState = {
  settings: ModelSettings | null;
  save: (s: ModelSettings) => void;
  clear: () => void;
};

export const useModelSettingsStore = create<ModelSettingsState>()(
  persist(
    (set) => ({
      settings: null,
      save: (settings) => set({ settings }),
      clear: () => set({ settings: null }),
    }),
    { name: 'ag2b.demo.modelSettings' }
  )
);
