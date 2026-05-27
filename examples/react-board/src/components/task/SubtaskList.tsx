import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useTasksStore } from '../../domain/tasks';
import type { Subtask } from '../../domain/types';

type SubtaskListProps = {
  taskId: string;
  subtasks: Subtask[];
};

export function SubtaskList({ taskId, subtasks }: SubtaskListProps) {
  const addSubtask = useTasksStore((s) => s.addSubtask);
  const toggleSubtask = useTasksStore((s) => s.toggleSubtask);
  const renameSubtask = useTasksStore((s) => s.renameSubtask);
  const removeSubtask = useTasksStore((s) => s.removeSubtask);

  const [newText, setNewText] = useState('');
  const done = subtasks.filter((s) => s.done).length;

  function onAdd() {
    const trimmed = newText.trim();
    if (!trimmed) return;
    addSubtask(taskId, trimmed);
    setNewText('');
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Subtasks
        </span>
        {subtasks.length > 0 ? (
          <span className="text-xs text-neutral-500">
            {done} / {subtasks.length}
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1">
        {subtasks.map((sub) => (
          <SubtaskRow
            key={sub.id}
            subtask={sub}
            onToggle={() => toggleSubtask(taskId, sub.id)}
            onRename={(text) => renameSubtask(taskId, sub.id, text)}
            onRemove={() => removeSubtask(taskId, sub.id)}
          />
        ))}
      </ul>
      <input
        type="text"
        placeholder="+ Add subtask..."
        value={newText}
        onChange={(e) => setNewText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd();
          }
        }}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        className="rounded border border-dashed border-neutral-700 bg-transparent px-2 py-1.5 text-sm text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
      />
    </div>
  );
}

type SubtaskRowProps = {
  subtask: Subtask;
  onToggle: () => void;
  onRename: (text: string) => void;
  onRemove: () => void;
};

export function SubtaskRow({ subtask, onToggle, onRename, onRemove }: SubtaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.text);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== subtask.text) {
      onRename(trimmed);
    } else {
      setDraft(subtask.text);
    }
    setEditing(false);
  }

  return (
    <li className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-neutral-800/40">
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={onToggle}
        className="h-4 w-4 cursor-pointer rounded border-neutral-600 bg-neutral-800 accent-sky-500"
      />
      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setDraft(subtask.text);
              setEditing(false);
            }
          }}
          autoFocus
          className="flex-1 rounded bg-neutral-800 px-1 py-0.5 text-sm text-neutral-200 focus:outline-none"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={[
            'flex-1 cursor-text text-sm',
            subtask.done ? 'text-neutral-500 line-through' : 'text-neutral-200',
          ].join(' ')}
        >
          {subtask.text}
        </span>
      )}
      <button
        type="button"
        aria-label="Remove subtask"
        onClick={onRemove}
        className="rounded p-1 text-neutral-500 opacity-0 transition-opacity hover:bg-neutral-700 hover:text-rose-400 group-hover:opacity-100"
      >
        <Trash2 size={12} />
      </button>
    </li>
  );
}
