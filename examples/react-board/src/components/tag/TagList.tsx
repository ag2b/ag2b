import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useSettingsStore } from '../../domain/settings';
import { type Tag, TAG_COLORS } from '../../domain/types';
import { TAG_BG, TAG_RING } from './tag-styles';

export function TagList() {
  const tags = useSettingsStore((s) => s.tags);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
        Your tags{tags.length > 0 ? ` (${tags.length})` : ''}
      </h2>
      {tags.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-600">
          No tags yet — create your first one above.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tags.map((tag) => (
            <TagCard key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </section>
  );
}

type TagCardProps = { tag: Tag };

function TagCard({ tag }: TagCardProps) {
  const renameTag = useSettingsStore((s) => s.renameTag);
  const recolorTag = useSettingsStore((s) => s.recolorTag);
  const deleteTag = useSettingsStore((s) => s.deleteTag);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag.name);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== tag.name) {
      renameTag(tag.id, trimmed);
    } else {
      setDraft(tag.name);
    }
    setEditing(false);
  }

  return (
    <li className="group flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 transition-colors hover:border-neutral-700">
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TAG_BG[tag.color]}`} />
        {editing ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                setDraft(tag.name);
                setEditing(false);
              }
            }}
            autoFocus
            className="flex-1 rounded bg-neutral-800 px-1.5 py-0.5 text-sm text-neutral-100 focus:outline-none"
          />
        ) : (
          <span className="flex-1 truncate text-sm font-medium text-neutral-200">{tag.name}</span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label="Rename tag"
            onClick={() => setEditing(true)}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-100"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            aria-label="Delete tag"
            onClick={() => deleteTag(tag.id)}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-rose-400"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Set color ${c}`}
            aria-pressed={c === tag.color}
            onClick={() => recolorTag(tag.id, c)}
            className={[
              'h-4 w-4 rounded-full transition-transform',
              TAG_BG[c],
              c === tag.color
                ? `ring-2 ring-offset-2 ring-offset-neutral-900 ${TAG_RING[c]}`
                : 'opacity-50 hover:scale-110 hover:opacity-100',
            ].join(' ')}
          />
        ))}
      </div>
    </li>
  );
}
