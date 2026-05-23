import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Button, useOverlayState } from '@heroui/react';
import { Plus, Settings } from 'lucide-react';
import { useState } from 'react';

import { COLUMN_IDS, COLUMNS } from '../domain/columns';
import { useBoardStore } from '../domain/store';
import type { ColumnId, Task } from '../domain/types';
import { Column } from './Column';
import { SettingsModal } from './SettingsModal';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';

function noop() {
  /* overlay clone is non-interactive */
}

function isColumnId(value: string): value is ColumnId {
  return (COLUMN_IDS as readonly string[]).includes(value);
}

function tasksInColumn(tasks: Task[], id: ColumnId): Task[] {
  return tasks.filter((t) => t.status === id).sort((a, b) => a.order - b.order);
}

// Pointer-first: whichever droppable contains the cursor wins, falling back
// to rect intersection then closest-center. Prevents the "snap back to source
// column" bug from corner-based detection at column boundaries.
const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  const rect = rectIntersection(args);
  if (rect.length > 0) return rect;
  return closestCenter(args);
};

export function Board() {
  const tasks = useBoardStore((s) => s.tasks);
  const moveTask = useBoardStore((s) => s.moveTask);
  const modalState = useOverlayState();
  const settingsState = useOverlayState();
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function openCreate() {
    setEditingTask(undefined);
    modalState.open();
  }
  function openEdit(task: Task) {
    setEditingTask(task);
    modalState.open();
  }

  function onDragStart(event: DragStartEvent) {
    const task = useBoardStore.getState().tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const current = useBoardStore.getState().tasks;
    const activeTaskNow = current.find((t) => t.id === activeId);
    if (!activeTaskNow) return;

    const targetColumn: ColumnId | undefined = isColumnId(overId)
      ? overId
      : current.find((t) => t.id === overId)?.status;
    if (!targetColumn) return;
    if (activeTaskNow.status === targetColumn) return;

    const tail = current.filter((t) => t.status === targetColumn && t.id !== activeId).length;
    moveTask(activeId, targetColumn, tail);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    if (isColumnId(overId)) return;

    const current = useBoardStore.getState().tasks;
    const overTask = current.find((t) => t.id === overId);
    if (!overTask) return;

    const colTasks = tasksInColumn(current, overTask.status).filter((t) => t.id !== activeId);
    const targetIdx = colTasks.findIndex((t) => t.id === overTask.id);
    moveTask(activeId, overTask.status, targetIdx === -1 ? colTasks.length : targetIdx);
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <div className="flex h-screen flex-col gap-5 px-6 py-6">
        <header className="flex items-center justify-between border-b border-neutral-800 pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">react-board</h1>
            <p className="text-sm text-neutral-400">
              Drag tasks between columns. Click pencil to edit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="md" onPress={openCreate}>
              <Plus size={16} className="mr-1.5 -ml-0.5" />
              Add task
            </Button>
            <Button
              variant="ghost"
              size="md"
              isIconOnly
              aria-label="Settings"
              onPress={() => settingsState.open()}
            >
              <Settings size={16} />
            </Button>
          </div>
        </header>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <main className="flex flex-1 gap-5 overflow-x-auto pb-2">
            {COLUMNS.map((col) => (
              <Column
                key={col.id}
                id={col.id}
                label={col.label}
                tasks={tasksInColumn(tasks, col.id)}
                onEditTask={openEdit}
              />
            ))}
          </main>
          <DragOverlay dropAnimation={null}>
            {activeTask ? <TaskCard task={activeTask} onEdit={noop} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
        <TaskModal state={modalState} task={editingTask} />
        <SettingsModal state={settingsState} />
      </div>
    </div>
  );
}
