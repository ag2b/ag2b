import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, Pencil, Trash2 } from 'lucide-react';

import { findPerson } from '../../domain/people';
import { useSettingsStore } from '../../domain/settings';
import { useTasksStore } from '../../domain/tasks';
import type { Task } from '../../domain/types';
import { PersonAvatar } from '../PersonAvatar';
import { TagChip } from '../tag/TagChip';
import { PRIORITY_META } from './priority-meta';

type TaskCardProps = {
  task: Task;
  onEdit: (task: Task) => void;
  isOverlay?: boolean;
};

const MAX_VISIBLE_TAGS = 2;

export function TaskCard({ task, onEdit, isOverlay = false }: TaskCardProps) {
  const removeTask = useTasksStore((s) => s.removeTask);
  const tags = useSettingsStore((s) => s.tags);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isPlaceholder = isDragging && !isOverlay;
  const { icon: PriorityIcon, color: priorityColor } = PRIORITY_META[task.priority];

  const visibleTags = task.tagIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined)
    .slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = task.tagIds.length - visibleTags.length;

  const subtaskDone = task.subtasks.filter((s) => s.done).length;
  const hasSubtasks = task.subtasks.length > 0;

  const assignee = findPerson(task.assigneeId);

  const showRow2 = visibleTags.length > 0 || hasSubtasks || assignee;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className={[
          'group flex flex-col gap-2 rounded-lg border px-3 py-2.5 transition-colors',
          isPlaceholder
            ? 'border-dashed border-neutral-700 bg-neutral-900/40 [&>*]:invisible'
            : 'border-neutral-800 bg-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-800',
          isOverlay
            ? 'cursor-grabbing shadow-2xl ring-1 ring-neutral-700'
            : 'cursor-grab active:cursor-grabbing',
        ].join(' ')}
      >
        <div className="flex items-center gap-2">
          <PriorityIcon size={14} className={`shrink-0 ${priorityColor}`} />
          <p className="flex-1 truncate text-sm leading-snug text-neutral-100">{task.name}</p>
          <div
            className={[
              'flex shrink-0 gap-0.5 transition-opacity',
              isOverlay ? 'opacity-0' : 'opacity-0 group-hover:opacity-100',
            ].join(' ')}
          >
            <button
              type="button"
              aria-label="Edit task"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="cursor-pointer rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              aria-label="Delete task"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                removeTask(task.id);
              }}
              className="cursor-pointer rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-rose-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {showRow2 ? (
          <div className="flex items-center gap-2">
            {visibleTags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
            {hiddenTagCount > 0 ? (
              <span className="text-xs text-neutral-500">+{hiddenTagCount}</span>
            ) : null}
            {hasSubtasks ? (
              <span className="flex items-center gap-1 text-xs text-neutral-500">
                <CheckSquare size={12} />
                {subtaskDone}/{task.subtasks.length}
              </span>
            ) : null}
            {assignee ? (
              <span className="ml-auto">
                <PersonAvatar person={assignee} size="sm" />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
