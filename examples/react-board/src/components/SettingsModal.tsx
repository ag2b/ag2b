import {
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  useOverlayState,
} from '@heroui/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useBoardStore } from '../domain/store';
import { TAG_BG, TAG_COLORS, TAG_RING } from '../domain/tag-colors';
import type { Tag, TagColor } from '../domain/types';

type SettingsModalProps = {
  state: ReturnType<typeof useOverlayState>;
};

export function SettingsModal({ state }: SettingsModalProps) {
  return (
    <Modal state={state}>
      <ModalBackdrop>
        <ModalContainer placement="center" size="md">
          <ModalDialog>
            <ModalHeader className="px-4 pt-4 pb-1">
              <ModalHeading className="text-base font-semibold">Settings</ModalHeading>
            </ModalHeader>
            <ModalBody className="flex flex-col gap-4 px-4 pt-2 pb-4">
              <TagsSection />
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}

function TagsSection() {
  const tags = useBoardStore((s) => s.tags);
  const createTag = useBoardStore((s) => s.createTag);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('sky');

  function onAddTag() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createTag({ name: trimmed, color: newColor });
    setNewName('');
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400">Tags</h3>
      <ul className="flex flex-col gap-1">
        {tags.length === 0 ? (
          <li className="rounded border border-dashed border-neutral-800 px-3 py-3 text-center text-xs text-neutral-600">
            No tags yet
          </li>
        ) : (
          tags.map((tag) => <TagRow key={tag.id} tag={tag} />)
        )}
      </ul>
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
    </section>
  );
}

type TagRowProps = { tag: Tag };

function TagRow({ tag }: TagRowProps) {
  const renameTag = useBoardStore((s) => s.renameTag);
  const recolorTag = useBoardStore((s) => s.recolorTag);
  const deleteTag = useBoardStore((s) => s.deleteTag);

  const [editing, setEditing] = useState(false);
  const [pickingColor, setPickingColor] = useState(false);
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
    <li className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-neutral-800/40">
      <button
        type="button"
        aria-label="Change color"
        onClick={() => setPickingColor((v) => !v)}
        className={`h-3 w-3 rounded-full ${TAG_BG[tag.color]}`}
      />
      {pickingColor ? (
        <div className="flex items-center gap-1">
          {TAG_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => {
                recolorTag(tag.id, color);
                setPickingColor(false);
              }}
              className={`h-4 w-4 rounded-full ${TAG_BG[color]} ${color === tag.color ? `ring-1 ${TAG_RING[color]}` : ''}`}
            />
          ))}
        </div>
      ) : editing ? (
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
          className="flex-1 rounded bg-neutral-800 px-1 py-0.5 text-sm text-neutral-200 focus:outline-none"
        />
      ) : (
        <span className="flex-1 text-sm text-neutral-200">{tag.name}</span>
      )}
      <button
        type="button"
        aria-label="Rename tag"
        onClick={() => setEditing(true)}
        className="rounded p-1 text-neutral-500 opacity-0 transition-opacity hover:bg-neutral-700 hover:text-neutral-100 group-hover:opacity-100"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        aria-label="Delete tag"
        onClick={() => deleteTag(tag.id)}
        className="rounded p-1 text-neutral-500 opacity-0 transition-opacity hover:bg-neutral-700 hover:text-rose-400 group-hover:opacity-100"
      >
        <Trash2 size={12} />
      </button>
    </li>
  );
}
