import { create } from 'zustand';

import { seedTasks } from './seed';
import type { ColumnId, Priority, Subtask, Task } from './types';

type TasksState = {
  tasks: Task[];

  // tasks
  addTask: (input: {
    name: string;
    priority: Priority;
    description?: string;
    status?: ColumnId;
    assigneeId?: string | null;
    tagIds?: string[];
    subtasks?: string[];
  }) => string;
  updateTask: (
    id: string,
    patch: Partial<Pick<Task, 'name' | 'priority' | 'description' | 'assigneeId' | 'tagIds'>>
  ) => void;
  removeTask: (id: string) => void;
  moveTask: (id: string, toStatus: ColumnId, toIndex: number) => void;

  // assignee
  assignTask: (taskId: string, personId: string | null) => void;

  // subtasks
  addSubtask: (taskId: string, text: string, done?: boolean) => void;
  renameSubtask: (taskId: string, subtaskId: string, text: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  removeSubtask: (taskId: string, subtaskId: string) => void;
  completeAllSubtasks: (taskId: string) => void;

  // tags — relation (the tag collection itself lives in the settings store)
  toggleTagOnTask: (taskId: string, tagId: string) => void;
  // Strip a deleted tag from every task. Called by the settings store on tag deletion.
  purgeTag: (tagId: string) => void;
};

function renumber(tasks: Task[]): Task[] {
  const counters: Record<ColumnId, number> = {
    backlog: 0,
    inProgress: 0,
    done: 0,
  };
  return tasks.map((t) => ({ ...t, order: counters[t.status]++ }));
}

function patchTask(tasks: Task[], id: string, mutate: (task: Task) => Task): Task[] {
  return tasks.map((t) => (t.id === id ? mutate(t) : t));
}

function requireTask(tasks: Task[], id: string): void {
  if (!tasks.some((t) => t.id === id)) {
    throw new Error(`No task with id "${id}"`);
  }
}

// Keep only the keys whose value is defined, so a patch with `undefined` fields
// doesn't clobber existing task values when spread.
function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: seedTasks(),

  addTask: (input) => {
    const id = crypto.randomUUID();
    set((s) => {
      const status = input.status ?? 'backlog';
      const order = s.tasks.filter((t) => t.status === status).length;
      const next: Task = {
        id,
        name: input.name,
        priority: input.priority,
        status,
        order,
        description: input.description ?? '',
        subtasks: (input.subtasks ?? []).map((text) => ({
          id: crypto.randomUUID(),
          text,
          done: false,
        })),
        tagIds: input.tagIds ?? [],
        assigneeId: input.assigneeId ?? null,
      };
      return { tasks: [...s.tasks, next] };
    });
    return id;
  },

  updateTask: (id, patch) => {
    requireTask(get().tasks, id);
    set((s) => ({
      tasks: patchTask(s.tasks, id, (t) => ({ ...t, ...definedOnly(patch) })),
    }));
  },

  removeTask: (id) =>
    set((s) => ({
      tasks: renumber(s.tasks.filter((t) => t.id !== id)),
    })),

  moveTask: (id, toStatus, toIndex) => {
    requireTask(get().tasks, id);
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
    });
  },

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

  completeAllSubtasks: (taskId) =>
    set((s) => ({
      tasks: patchTask(s.tasks, taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.map((sub) => ({ ...sub, done: true })),
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

  purgeTag: (tagId) =>
    set((s) => ({
      tasks: s.tasks.map((t) => ({
        ...t,
        tagIds: t.tagIds.filter((id) => id !== tagId),
      })),
    })),
}));
