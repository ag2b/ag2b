import { Button, Input, Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { useBoardStore } from '../domain/store';
import { TAG_BG, TAG_COLORS, TAG_RING } from '../domain/tag-colors';
import type { Tag, TagColor } from '../domain/types';
import { TagChip } from './TagChip';

type TagPickerProps = {
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
};

export function TagPicker({ selectedTagIds, onToggle }: TagPickerProps) {
  const tags = useBoardStore((s) => s.tags);
  const createTag = useBoardStore((s) => s.createTag);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('sky');

  const selectedTags = selectedTagIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);

  function onAddTag() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const id = createTag({ name: trimmed, color: newColor });
    onToggle(id);
    setNewName('');
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedTags.map((tag) => (
        <TagChip key={tag.id} tag={tag} onRemove={() => onToggle(tag.id)} />
      ))}
      <Popover>
        <PopoverTrigger>
          <Button size="sm" variant="ghost">
            <Plus size={12} className="mr-1" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent
          placement="bottom start"
          className="flex w-72 flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-xl"
        >
          {tags.length > 0 ? (
            <div className="flex flex-col gap-1">
              {tags.map((tag) => {
                const checked = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggle(tag.id)}
                    className={[
                      'flex items-center gap-2 rounded px-2 py-1 text-left text-sm',
                      checked ? 'bg-neutral-800' : 'hover:bg-neutral-800',
                    ].join(' ')}
                  >
                    <span className={`h-2 w-2 rounded-full ${TAG_BG[tag.color]}`} />
                    <span className="flex-1 text-neutral-200">{tag.name}</span>
                    {checked ? <span className="text-xs text-neutral-500">{'✓'}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">No tags yet. Create one below.</p>
          )}
          <div className="flex flex-col gap-3 border-t border-neutral-800 pt-3">
            <Input
              placeholder="New tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddTag();
                }
              }}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
            />
            <div className="flex items-center gap-1.5">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => setNewColor(color)}
                  className={[
                    'h-5 w-5 rounded-full transition-all',
                    TAG_BG[color],
                    newColor === color
                      ? `ring-2 ring-offset-2 ring-offset-neutral-900 ${TAG_RING[color]}`
                      : '',
                  ].join(' ')}
                />
              ))}
            </div>
            <Button size="sm" variant="primary" onPress={onAddTag} isDisabled={!newName.trim()}>
              Add tag
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
