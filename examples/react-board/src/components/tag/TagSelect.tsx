import {
  ListBox,
  ListBoxItem,
  Select,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from '@heroui/react';
import { Check } from 'lucide-react';
import type { Key } from 'react';

import { useSettingsStore } from '../../domain/settings';
import type { Tag } from '../../domain/types';
import { TAG_BG } from './tag-styles';
import { TagChip } from './TagChip';

type TagSelectProps = {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
};

function toIds(value: Key | Key[] | null): string[] {
  if (value === null) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

export function TagSelect({ selectedTagIds, onChange }: TagSelectProps) {
  const tags = useSettingsStore((s) => s.tags);
  const selected = new Set(selectedTagIds);
  const selectedTags = selectedTagIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);

  if (tags.length === 0) {
    return <p className="text-xs text-neutral-500">No tags yet — create them in Settings.</p>;
  }

  return (
    <Select
      aria-label="Tags"
      variant="secondary"
      selectionMode="multiple"
      value={selectedTagIds}
      onChange={(value) => onChange(toIds(value))}
    >
      <SelectTrigger>
        <SelectValue>
          {() =>
            selectedTags.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {selectedTags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </span>
            ) : (
              <span className="text-neutral-500">Select tags</span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectPopover>
        <ListBox selectionMode="multiple">
          {tags.map((tag) => (
            <ListBoxItem key={tag.id} id={tag.id} textValue={tag.name}>
              <span className="flex w-full items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${TAG_BG[tag.color]}`} />
                <span className="flex-1">{tag.name}</span>
                {selected.has(tag.id) ? <Check size={14} className="text-neutral-400" /> : null}
              </span>
            </ListBoxItem>
          ))}
        </ListBox>
      </SelectPopover>
    </Select>
  );
}
