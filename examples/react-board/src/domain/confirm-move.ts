import { create } from 'zustand';

import { useTasksStore } from './tasks';
import type { ColumnId } from './types';

// A move into `done` is gated when the task still has unchecked subtasks.
function incompleteSubtaskCount(taskId: string): number {
  const task = useTasksStore.getState().tasks.find((t) => t.id === taskId);
  if (!task) return 0;
  return task.subtasks.filter((s) => !s.done).length;
}

type PendingMove = {
  taskName: string;
  incompleteCount: number;
  // Resolves the request() promise: true = complete subtasks and move, false = cancel.
  resolve: (confirmed: boolean) => void;
};

type ConfirmMoveState = {
  pending: PendingMove | null;
  request: (move: Omit<PendingMove, 'resolve'>) => Promise<boolean>;
  confirm: () => void;
  cancel: () => void;
};

// Bridges a pending move from non-React callers (the agent tool) and React callers
// (drag) to a modal. The modal renders off `pending` and calls confirm()/cancel().
export const useConfirmMoveStore = create<ConfirmMoveState>((set, get) => ({
  pending: null,
  request: (move) =>
    new Promise<boolean>((resolve) => {
      set({ pending: { ...move, resolve } });
    }),
  confirm: () => {
    const p = get().pending;
    if (!p) return;
    p.resolve(true);
    set({ pending: null });
  },
  cancel: () => {
    const p = get().pending;
    if (!p) return;
    p.resolve(false);
    set({ pending: null });
  },
}));

/**
 * Move a task, gating moves into `done` that have incomplete subtasks behind a
 * human confirmation. Shared by manual drag and the agent's moveTask tool.
 *
 * Returns `{ moved: false }` if the user cancels the gated move.
 */
export async function requestMoveTask(
  id: string,
  toStatus: ColumnId,
  toIndex: number
): Promise<{ moved: boolean }> {
  const { tasks, moveTask, completeAllSubtasks } = useTasksStore.getState();
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`No task with id "${id}"`);

  const incompleteCount = incompleteSubtaskCount(id);
  if (toStatus === 'done' && incompleteCount > 0) {
    const confirmed = await useConfirmMoveStore
      .getState()
      .request({ taskName: task.name, incompleteCount });
    if (!confirmed) return { moved: false };
    completeAllSubtasks(id);
  }

  moveTask(id, toStatus, toIndex);
  return { moved: true };
}
