import { create } from 'zustand';

import type { Task } from './types';

export type Filters = {
  text: string;
  tagIds: string[];
  // null represents "unassigned".
  assigneeIds: (string | null)[];
};

type FiltersState = Filters & {
  setText: (text: string) => void;
  setTagIds: (tagIds: string[]) => void;
  setAssigneeIds: (assigneeIds: (string | null)[]) => void;
  clear: () => void;
};

export const useFiltersStore = create<FiltersState>((set) => ({
  text: '',
  tagIds: [],
  assigneeIds: [],
  setText: (text) => set({ text }),
  setTagIds: (tagIds) => set({ tagIds }),
  setAssigneeIds: (assigneeIds) => set({ assigneeIds }),
  clear: () => set({ text: '', tagIds: [], assigneeIds: [] }),
}));

export function hasActiveFilters(f: Filters): boolean {
  return f.text.trim() !== '' || f.tagIds.length > 0 || f.assigneeIds.length > 0;
}

// AND across the three filter types, OR within each.
export function matchesFilters(task: Task, f: Filters): boolean {
  const q = f.text.trim().toLowerCase();
  if (q && !task.name.toLowerCase().includes(q) && !task.description.toLowerCase().includes(q)) {
    return false;
  }
  if (f.tagIds.length > 0 && !task.tagIds.some((id) => f.tagIds.includes(id))) {
    return false;
  }
  if (f.assigneeIds.length > 0 && !f.assigneeIds.includes(task.assigneeId)) {
    return false;
  }
  return true;
}
