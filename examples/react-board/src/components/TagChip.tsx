import { X } from 'lucide-react';

import { TAG_BG } from '../domain/tag-colors';
import type { Tag } from '../domain/types';

type TagChipProps = {
  tag: Tag;
  onRemove?: () => void;
};

export function TagChip({ tag, onRemove }: TagChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800/80 px-2 py-0.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${TAG_BG[tag.color]}`} />
      <span className="text-neutral-200">{tag.name}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${tag.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="-mr-1 ml-0.5 rounded p-0.5 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-100"
        >
          <X size={10} />
        </button>
      ) : null}
    </span>
  );
}
