import { Button, Input } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { useSettingsStore } from '../../domain/settings';
import { TAG_COLORS, type TagColor } from '../../domain/types';
import { TAG_BG, TAG_RING } from './tag-styles';

export function TagCreator() {
  const createTag = useSettingsStore((s) => s.createTag);

  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>('sky');

  const trimmed = name.trim();

  function onAdd() {
    if (!trimmed) return;
    createTag({ name: trimmed, color });
    setName('');
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
          Create a tag
        </h2>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>Preview</span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800/80 px-2.5 py-1">
            <span className={`h-2 w-2 rounded-full ${TAG_BG[color]}`} />
            <span
              className={`text-xs font-medium ${trimmed ? 'text-neutral-200' : 'text-neutral-600'}`}
            >
              {trimmed || 'tag name'}
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">Name</span>
          <Input
            placeholder="e.g. bug, feature, urgent"
            variant="secondary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAdd();
              }
            }}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">Color</span>
          <div className="flex items-center gap-2">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full transition-transform',
                  TAG_BG[c],
                  color === c
                    ? `scale-110 ring-2 ring-offset-2 ring-offset-neutral-900 ${TAG_RING[c]}`
                    : 'opacity-70 hover:opacity-100',
                ].join(' ')}
              >
                {color === c ? <Check size={13} className="text-neutral-950" /> : null}
              </button>
            ))}
          </div>
        </div>

        <Button variant="primary" onPress={onAdd} isDisabled={!trimmed}>
          <Plus size={16} className="mr-1.5 -ml-0.5" />
          Add tag
        </Button>
      </div>
    </section>
  );
}
