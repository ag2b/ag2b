import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { ColumnId, Task } from '../domain/types';
import { TaskCard } from './TaskCard';

type ColumnProps = {
  id: ColumnId;
  label: string;
  tasks: Task[];
  onEditTask: (task: Task) => void;
};

const ACCENT: Record<ColumnId, string> = {
  backlog: 'bg-neutral-500',
  inProgress: 'bg-sky-500',
  review: 'bg-amber-500',
  done: 'bg-emerald-500',
};

export function Column({ id, label, tasks, onEditTask }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  const { over } = useDndContext();

  // Highlight when the column itself is hovered OR when a task in this column is hovered.
  // useDroppable's `isOver` only fires for the column-id collision; once the pointer
  // crosses onto a task card, `over.id` becomes the task id and the column de-highlights.
  const overId = over ? String(over.id) : null;
  const isActiveColumn = overId !== null && (overId === id || tasks.some((t) => t.id === overId));

  return (
    <section
      ref={setNodeRef}
      className={[
        'flex w-80 shrink-0 flex-col rounded-xl border bg-neutral-900/60 transition-colors',
        isActiveColumn ? 'border-neutral-500 bg-neutral-900' : 'border-neutral-800',
      ].join(' ')}
    >
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${ACCENT[id]}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            {label}
          </span>
          <span className="text-xs text-neutral-500">{tasks.length}</span>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-2 px-3 pt-1 pb-3">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-xs text-neutral-600">
              Drop tasks here
            </div>
          ) : (
            tasks.map((task) => <TaskCard key={task.id} task={task} onEdit={onEditTask} />)
          )}
        </SortableContext>
      </div>
    </section>
  );
}
