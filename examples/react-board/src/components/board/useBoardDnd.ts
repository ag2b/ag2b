import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  closestCenter,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useRef, useState } from 'react';

import { COLUMN_IDS } from '../../domain/columns';
import { requestMoveTask } from '../../domain/confirm-move';
import { useTasksStore } from '../../domain/tasks';
import type { ColumnId, Task } from '../../domain/types';

function hasIncompleteSubtasks(task: Task): boolean {
  return task.subtasks.some((s) => !s.done);
}

function isColumnId(value: string): value is ColumnId {
  return (COLUMN_IDS as readonly string[]).includes(value);
}

export function tasksInColumn(tasks: Task[], id: ColumnId): Task[] {
  return tasks.filter((t) => t.status === id).sort((a, b) => a.order - b.order);
}

// Pointer-first detection (dnd-kit's multiple-containers recipe). We resolve what's
// directly under the cursor, and when that's a column we snap to the closest card
// *within that column*. This keeps cross-column drops working even when a filter has
// emptied or shortened the destination column — a global closestCenter would otherwise
// pick the nearest card in the taller source column and skip the move.
const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  const intersections = pointer.length > 0 ? pointer : rectIntersection(args);
  const overId = getFirstCollision(intersections, 'id');
  if (overId === null || overId === undefined) return [];

  if (isColumnId(String(overId))) {
    const inColumn = new Set(
      useTasksStore
        .getState()
        .tasks.filter((t) => t.status === overId)
        .map((t) => t.id)
    );
    const cardsInColumn = args.droppableContainers.filter((c) => inColumn.has(String(c.id)));
    if (cardsInColumn.length > 0) {
      return closestCenter({ ...args, droppableContainers: cardsInColumn });
    }
  }
  return [{ id: overId }];
};

// Resolve a drag-over target into (destination column, insertion index in the column
// AS IT EXISTS RIGHT NOW, including the active card if it's already in that column).
// The index is meant for moveTask, which removes the active card before splicing it in:
//   - Cross-column hover over card X       → X's index (active not present; lands before X)
//   - Same-column hover over card X (down) → X's index (X shifts up after removal; lands after X)
//   - Same-column hover over card X (up)   → X's index (X unchanged; lands before X)
//   - Hover over an empty column / column  → column length (append)
// This is the arrayMove convention: both directions reduce to "splice at over's index".
function resolveTarget(
  tasks: Task[],
  activeId: string,
  overId: string
): { column: ColumnId; index: number } | null {
  if (isColumnId(overId)) {
    const tail = tasksInColumn(tasks, overId).filter((t) => t.id !== activeId).length;
    return { column: overId, index: tail };
  }
  const overTask = tasks.find((t) => t.id === overId);
  if (!overTask) return null;
  const colTasks = tasksInColumn(tasks, overTask.status);
  const overIdx = colTasks.findIndex((t) => t.id === overId);
  return { column: overTask.status, index: overIdx };
}

export function useBoardDnd() {
  const tasks = useTasksStore((s) => s.tasks);
  const moveTask = useTasksStore((s) => s.moveTask);
  const [activeId, setActiveId] = useState<string | null>(null);
  // The card's column + index at drag start, so a cancelled Done gate can undo the
  // eager cross-column moves made while dragging past intermediate columns.
  const originRef = useRef<{ status: ColumnId; index: number } | null>(null);

  const activeTask = activeId ? (tasks.find((t) => t.id === activeId) ?? null) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveId(id);
    const current = useTasksStore.getState().tasks;
    const task = current.find((t) => t.id === id);
    originRef.current = task
      ? {
          status: task.status,
          index: tasksInColumn(current, task.status).findIndex((t) => t.id === id),
        }
      : null;
  }

  // Cross-column moves happen on hover so the visual layout matches the destination
  // column while dragging. Same-column reordering is left to onDragEnd — the
  // SortableContext animates the preview without store churn.
  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const aId = String(active.id);
    const oId = String(over.id);
    if (aId === oId) return;

    const current = useTasksStore.getState().tasks;
    const aTask = current.find((t) => t.id === aId);
    if (!aTask) return;

    const target = resolveTarget(current, aId, oId);
    if (!target) return;
    if (aTask.status === target.column) return;
    // Don't eagerly slide a gated task into Done on hover — the move is confirmed on
    // drop, so the card shouldn't pre-jump before the user answers the modal.
    if (target.column === 'done' && hasIncompleteSubtasks(aTask)) return;

    moveTask(aId, target.column, target.index);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const aId = String(active.id);
    const oId = String(over.id);
    if (aId === oId) return;

    const current = useTasksStore.getState().tasks;
    const target = resolveTarget(current, aId, oId);
    if (!target) return;

    // Gates moves into Done with incomplete subtasks behind a confirm modal.
    const origin = originRef.current;
    void requestMoveTask(aId, target.column, target.index).then(({ moved }) => {
      // Cancelled gate: undo any eager cross-column moves from dragging past columns.
      if (!moved && origin) {
        useTasksStore.getState().moveTask(aId, origin.status, origin.index);
      }
    });
  }

  return { sensors, collisionDetection, activeTask, onDragStart, onDragOver, onDragEnd };
}
