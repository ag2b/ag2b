import { Pencil } from 'lucide-react';

import { PROVIDER_DEFAULTS, useModelSettingsStore } from '../../domain/model-settings';

type Props = {
  onEdit: () => void;
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ProviderSummary({ onEdit }: Props) {
  const settings = useModelSettingsStore((s) => s.settings);
  if (!settings) return null;

  const parts = [PROVIDER_DEFAULTS[settings.provider].label, hostOf(settings.baseURL)];
  if (settings.model) parts.push(settings.model);

  return (
    <div className="flex items-center gap-2 text-sm text-neutral-400">
      <span>{parts.join(' · ')}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit provider settings"
        className="cursor-pointer rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
