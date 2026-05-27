import {
  Button,
  Input,
  ListBox,
  ListBoxItem,
  Select,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from '@heroui/react';
import { Search, X } from 'lucide-react';
import type { Key } from 'react';

import { useFiltersStore } from '../../domain/filters';
import { PEOPLE } from '../../domain/people';
import { useSettingsStore } from '../../domain/settings';
import { PersonAvatar } from '../PersonAvatar';
import { TAG_BG } from '../tag/tag-styles';

const UNASSIGNED_KEY = '__unassigned__';

function toKeys(value: Key | Key[] | null): string[] {
  if (value === null) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

export function FilterBar() {
  const text = useFiltersStore((s) => s.text);
  const tagIds = useFiltersStore((s) => s.tagIds);
  const assigneeIds = useFiltersStore((s) => s.assigneeIds);
  const setText = useFiltersStore((s) => s.setText);
  const setTagIds = useFiltersStore((s) => s.setTagIds);
  const setAssigneeIds = useFiltersStore((s) => s.setAssigneeIds);
  const clear = useFiltersStore((s) => s.clear);

  const tags = useSettingsStore((s) => s.tags);

  const active = text.trim() !== '' || tagIds.length > 0 || assigneeIds.length > 0;
  // null (unassigned) is encoded as a sentinel key for the Select.
  const assigneeKeys = assigneeIds.map((id) => id ?? UNASSIGNED_KEY);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-neutral-500"
        />
        <Input
          aria-label="Search tasks"
          placeholder="Search title or description"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          className="w-64 pl-8"
        />
      </div>

      <Select
        aria-label="Filter by tags"
        selectionMode="multiple"
        value={tagIds}
        onChange={(v) => setTagIds(toKeys(v))}
      >
        <SelectTrigger>
          <SelectValue>
            {() => (tagIds.length > 0 ? `${tagIds.length} tag(s)` : 'Tags')}
          </SelectValue>
        </SelectTrigger>
        <SelectPopover>
          <ListBox selectionMode="multiple">
            {tags.map((tag) => (
              <ListBoxItem key={tag.id} id={tag.id} textValue={tag.name}>
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${TAG_BG[tag.color]}`} />
                  {tag.name}
                </span>
              </ListBoxItem>
            ))}
          </ListBox>
        </SelectPopover>
      </Select>

      <Select
        aria-label="Filter by assignee"
        selectionMode="multiple"
        value={assigneeKeys}
        onChange={(v) => setAssigneeIds(toKeys(v).map((k) => (k === UNASSIGNED_KEY ? null : k)))}
      >
        <SelectTrigger>
          <SelectValue>
            {() => (assigneeIds.length > 0 ? `${assigneeIds.length} assignee(s)` : 'Assignee')}
          </SelectValue>
        </SelectTrigger>
        <SelectPopover>
          <ListBox selectionMode="multiple">
            <ListBoxItem id={UNASSIGNED_KEY} textValue="Unassigned">
              <span className="text-neutral-400">Unassigned</span>
            </ListBoxItem>
            {PEOPLE.map((person) => (
              <ListBoxItem key={person.id} id={person.id} textValue={person.name}>
                <span className="flex items-center gap-2">
                  <PersonAvatar person={person} size="sm" />
                  {person.name}
                </span>
              </ListBoxItem>
            ))}
          </ListBox>
        </SelectPopover>
      </Select>

      {active ? (
        <Button size="sm" variant="ghost" onPress={() => clear()}>
          <X size={14} className="mr-1 -ml-0.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
