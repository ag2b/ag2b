import { DndContext, DragOverlay } from '@dnd-kit/core';
import { Button, useOverlayState } from '@heroui/react';
import { Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { BoardHeader } from '../components/board/BoardHeader';
import { Column } from '../components/board/Column';
import { FilterBar } from '../components/board/FilterBar';
import { MoveConfirmModal } from '../components/board/MoveConfirmModal';
import { SystemPanel } from '../components/board/SystemPanel';
import { tasksInColumn, useBoardDnd } from '../components/board/useBoardDnd';
import { ProviderSettingsModal } from '../components/provider/ProviderSettingsModal';
import { TaskCard } from '../components/task/TaskCard';
import { TaskModal } from '../components/task/TaskModal';
import { COLUMNS } from '../domain/columns';
import { matchesFilters } from '../domain/filters';
import { useFiltersStore } from '../domain/filters';
import { useTasksStore } from '../domain/tasks';
import type { Task } from '../domain/types';

function noop() {
  /* overlay clone is non-interactive */
}

export function Board() {
  const navigate = useNavigate();
  const tasks = useTasksStore((s) => s.tasks);
  const text = useFiltersStore((s) => s.text);
  const tagIds = useFiltersStore((s) => s.tagIds);
  const assigneeIds = useFiltersStore((s) => s.assigneeIds);
  const modalState = useOverlayState();
  const providerSettingsState = useOverlayState();
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { sensors, collisionDetection, activeTask, onDragStart, onDragOver, onDragEnd } =
    useBoardDnd();

  // View-only: filtering affects what's rendered, not the drag source or the agent's
  // task context (both read the full list from the store).
  const filters = { text, tagIds, assigneeIds };
  const visibleInColumn = (id: Task['status']) =>
    tasksInColumn(tasks, id).filter((t) => matchesFilters(t, filters));

  function openCreate() {
    setEditingTask(undefined);
    modalState.open();
  }
  function openEdit(task: Task) {
    setEditingTask(task);
    modalState.open();
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <div className="flex h-screen flex-col gap-5 px-6 py-6">
        <BoardHeader onEditProvider={() => providerSettingsState.open()} />
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" size="md" onPress={openCreate}>
              <Plus size={16} className="mr-1.5 -ml-0.5" />
              Add task
            </Button>
            <Button
              variant="ghost"
              size="md"
              isIconOnly
              aria-label="Settings"
              onPress={() => void navigate('/settings')}
            >
              <Settings size={16} />
            </Button>
          </div>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
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
                tasks={visibleInColumn(col.id)}
                onEditTask={openEdit}
              />
            ))}
            <SystemPanel />
          </main>
          <DragOverlay dropAnimation={null}>
            {activeTask ? <TaskCard task={activeTask} onEdit={noop} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
        <TaskModal state={modalState} task={editingTask} />
        <ProviderSettingsModal state={providerSettingsState} mode="edit" />
        <MoveConfirmModal />
      </div>
    </div>
  );
}
