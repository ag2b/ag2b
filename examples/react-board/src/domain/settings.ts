import { create } from 'zustand';

import { SEED_TAGS } from './seed';
import { useTasksStore } from './tasks';
import type { Tag, TagColor } from './types';

type SettingsState = {
  tags: Tag[];

  createTag: (input: { name: string; color: TagColor }) => string;
  renameTag: (id: string, name: string) => void;
  recolorTag: (id: string, color: TagColor) => void;
  deleteTag: (id: string) => void;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  tags: [...SEED_TAGS],

  createTag: ({ name, color }) => {
    const id = crypto.randomUUID();
    set((s) => ({
      tags: [...s.tags, { id, name: name.trim(), color }],
    }));
    return id;
  },

  renameTag: (id, name) =>
    set((s) => {
      const trimmed = name.trim();
      if (!trimmed) return s;
      return {
        tags: s.tags.map((tag) => (tag.id === id ? { ...tag, name: trimmed } : tag)),
      };
    }),

  recolorTag: (id, color) =>
    set((s) => ({
      tags: s.tags.map((tag) => (tag.id === id ? { ...tag, color } : tag)),
    })),

  deleteTag: (id) => {
    if (!get().tags.some((tag) => tag.id === id)) {
      throw new Error(`No tag with id "${id}"`);
    }
    set((s) => ({ tags: s.tags.filter((tag) => tag.id !== id) }));
    // Tags live here but the relation lives on tasks — drop the id from every task.
    useTasksStore.getState().purgeTag(id);
  },
}));
