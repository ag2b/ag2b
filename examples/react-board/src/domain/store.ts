import { create } from 'zustand';

import type { ColumnId, Priority, Subtask, Tag, TagColor, Task } from './types';

type BoardState = {
  tasks: Task[];
  tags: Tag[];

  // tasks
  addTask: (input: { name: string; priority: Priority }) => string;
  updateTask: (id: string, patch: Partial<Pick<Task, 'name' | 'priority' | 'description'>>) => void;
  removeTask: (id: string) => void;
  moveTask: (id: string, toStatus: ColumnId, toIndex: number) => void;

  // assignee
  assignTask: (taskId: string, personId: string | null) => void;

  // subtasks
  addSubtask: (taskId: string, text: string, done?: boolean) => void;
  renameSubtask: (taskId: string, subtaskId: string, text: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  removeSubtask: (taskId: string, subtaskId: string) => void;

  // tags — collection
  createTag: (input: { name: string; color: TagColor }) => string;
  renameTag: (id: string, name: string) => void;
  recolorTag: (id: string, color: TagColor) => void;
  deleteTag: (id: string) => void;

  // tags — relation
  toggleTagOnTask: (taskId: string, tagId: string) => void;
};

function renumber(tasks: Task[]): Task[] {
  const counters: Record<ColumnId, number> = {
    backlog: 0,
    inProgress: 0,
    review: 0,
    done: 0,
  };
  return tasks.map((t) => ({ ...t, order: counters[t.status]++ }));
}

function patchTask(tasks: Task[], id: string, mutate: (task: Task) => Task): Task[] {
  return tasks.map((t) => (t.id === id ? mutate(t) : t));
}

export const useBoardStore = create<BoardState>((set) => ({
  tasks: [],
  tags: [],

  addTask: ({ name, priority }) => {
    const id = crypto.randomUUID();
    set((s) => {
      const orderInBacklog = s.tasks.filter((t) => t.status === 'backlog').length;
      const next: Task = {
        id,
        name,
        priority,
        status: 'backlog',
        order: orderInBacklog,
        description: '',
        subtasks: [],
        tagIds: [],
        assigneeId: null,
      };
      return { tasks: [...s.tasks, next] };
    });
    return id;
  },

  updateTask: (id, patch) =>
    set((s) => ({
      tasks: patchTask(s.tasks, id, (t) => ({ ...t, ...patch })),
    })),

  removeTask: (id) =>
    set((s) => ({
      tasks: renumber(s.tasks.filter((t) => t.id !== id)),
    })),

  moveTask: (id, toStatus, toIndex) =>
    set((s) => {
      const moving = s.tasks.find((t) => t.id === id);
      if (!moving) return s;

      const others = s.tasks.filter((t) => t.id !== id);
      const inTarget = others
        .filter((t) => t.status === toStatus)
        .sort((a, b) => a.order - b.order);
      const outside = others.filter((t) => t.status !== toStatus);

      const clampedIndex = Math.max(0, Math.min(toIndex, inTarget.length));
      inTarget.splice(clampedIndex, 0, { ...moving, status: toStatus });

      return { tasks: renumber([...outside, ...inTarget]) };
    }),

  assignTask: (taskId, personId) =>
    set((s) => ({
      tasks: patchTask(s.tasks, taskId, (t) => ({ ...t, assigneeId: personId })),
    })),

  addSubtask: (taskId, text, done = false) =>
    set((s) => {
      const trimmed = text.trim();
      if (!trimmed) return s;
      const sub: Subtask = { id: crypto.randomUUID(), text: trimmed, done };
      return {
        tasks: patchTask(s.tasks, taskId, (t) => ({
          ...t,
          subtasks: [...t.subtasks, sub],
        })),
      };
    }),

  renameSubtask: (taskId, subtaskId, text) =>
    set((s) => {
      const trimmed = text.trim();
      if (!trimmed) return s;
      return {
        tasks: patchTask(s.tasks, taskId, (t) => ({
          ...t,
          subtasks: t.subtasks.map((sub) =>
            sub.id === subtaskId ? { ...sub, text: trimmed } : sub
          ),
        })),
      };
    }),

  toggleSubtask: (taskId, subtaskId) =>
    set((s) => ({
      tasks: patchTask(s.tasks, taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.map((sub) =>
          sub.id === subtaskId ? { ...sub, done: !sub.done } : sub
        ),
      })),
    })),

  removeSubtask: (taskId, subtaskId) =>
    set((s) => ({
      tasks: patchTask(s.tasks, taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.filter((sub) => sub.id !== subtaskId),
      })),
    })),

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

  deleteTag: (id) =>
    set((s) => ({
      tags: s.tags.filter((tag) => tag.id !== id),
      tasks: s.tasks.map((t) => ({
        ...t,
        tagIds: t.tagIds.filter((tagId) => tagId !== id),
      })),
    })),

  toggleTagOnTask: (taskId, tagId) =>
    set((s) => ({
      tasks: patchTask(s.tasks, taskId, (t) => ({
        ...t,
        tagIds: t.tagIds.includes(tagId)
          ? t.tagIds.filter((id) => id !== tagId)
          : [...t.tagIds, tagId],
      })),
    })),
}));
