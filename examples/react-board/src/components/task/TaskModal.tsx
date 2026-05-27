import {
  Button,
  Form,
  Input,
  ListBox,
  ListBoxItem,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
  Select,
  SelectPopover,
  SelectTrigger,
  SelectValue,
  TextArea,
  useOverlayState,
} from '@heroui/react';
import type { Key } from 'react';
import { useState } from 'react';

import { findPerson, PEOPLE } from '../../domain/people';
import { useTasksStore } from '../../domain/tasks';
import type { Priority, Subtask, Task } from '../../domain/types';
import { PersonAvatar } from '../PersonAvatar';
import { TagSelect } from '../tag/TagSelect';
import { PRIORITY_META } from './priority-meta';
import { SubtaskList, SubtaskRow } from './SubtaskList';

type TaskModalProps = {
  state: ReturnType<typeof useOverlayState>;
  task?: Task;
};

const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];
const UNASSIGNED_KEY = '__unassigned__';

function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

type TaskFormProps = {
  task: Task | undefined;
  onClose: () => void;
};

function TaskForm({ task, onClose }: TaskFormProps) {
  const addTask = useTasksStore((s) => s.addTask);
  const updateTask = useTasksStore((s) => s.updateTask);
  const assignTask = useTasksStore((s) => s.assignTask);
  const toggleTagOnTask = useTasksStore((s) => s.toggleTagOnTask);
  const addSubtask = useTasksStore((s) => s.addSubtask);

  // Live store snapshot of the task being edited (so subtask/tag/assignee
  // mutations re-render the modal immediately).
  const liveTask = useTasksStore((s) => (task ? s.tasks.find((t) => t.id === task.id) : undefined));
  const editing = liveTask ?? task;
  const isEdit = task !== undefined;

  // Basic-fields draft state — committed on Save (edit) or Add (create).
  const [name, setName] = useState(editing?.name ?? '');
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 'medium');
  const [description, setDescription] = useState(editing?.description ?? '');

  // Create-mode-only draft state for optional fields.
  const [draftAssigneeId, setDraftAssigneeId] = useState<string | null>(null);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [draftSubtasks, setDraftSubtasks] = useState<Subtask[]>([]);
  const [draftSubtaskText, setDraftSubtaskText] = useState('');

  const currentAssigneeId = isEdit ? (editing?.assigneeId ?? null) : draftAssigneeId;
  const currentTagIds = isEdit ? (editing?.tagIds ?? []) : draftTagIds;
  const currentSubtasks = isEdit ? (editing?.subtasks ?? []) : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isEdit && task) {
      updateTask(task.id, { name: trimmed, priority, description });
    } else {
      const newId = addTask({ name: trimmed, priority });
      if (description.trim()) {
        updateTask(newId, { description });
      }
      if (draftAssigneeId) {
        assignTask(newId, draftAssigneeId);
      }
      for (const tagId of draftTagIds) {
        toggleTagOnTask(newId, tagId);
      }
      for (const sub of draftSubtasks) {
        addSubtask(newId, sub.text, sub.done);
      }
    }
    onClose();
  }

  function onPriorityChange(value: Key | null) {
    if (isPriority(value)) setPriority(value);
  }

  function onAssigneeChange(value: Key | null) {
    const next = value === UNASSIGNED_KEY || value === null ? null : String(value);
    if (isEdit && task) {
      assignTask(task.id, next);
    } else {
      setDraftAssigneeId(next);
    }
  }

  function onToggleTag(tagId: string) {
    if (isEdit && task) {
      toggleTagOnTask(task.id, tagId);
    } else {
      setDraftTagIds((prev) =>
        prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
      );
    }
  }

  // The multi-select reports the full set of selected ids; translate that into
  // per-tag toggles so create-mode (draft state) and edit-mode (store) share one path.
  function onTagsChange(nextTagIds: string[]) {
    const before = new Set(currentTagIds);
    const after = new Set(nextTagIds);
    for (const id of before) if (!after.has(id)) onToggleTag(id);
    for (const id of after) if (!before.has(id)) onToggleTag(id);
  }

  function onAddDraftSubtask() {
    const trimmed = draftSubtaskText.trim();
    if (!trimmed) return;
    setDraftSubtasks((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed, done: false }]);
    setDraftSubtaskText('');
  }

  function onToggleDraftSubtask(subtaskId: string) {
    setDraftSubtasks((prev) => prev.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)));
  }

  function onRenameDraftSubtask(subtaskId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraftSubtasks((prev) => prev.map((s) => (s.id === subtaskId ? { ...s, text: trimmed } : s)));
  }

  function onRemoveDraftSubtask(subtaskId: string) {
    setDraftSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
  }

  const assignee = findPerson(currentAssigneeId);

  return (
    <Form onSubmit={onSubmit} className="flex flex-col">
      <ModalHeader>
        <ModalHeading className="text-base font-semibold">
          {isEdit ? 'Edit task' : 'New task'}
        </ModalHeading>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4 p-1">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Name
          </span>
          <Input
            placeholder="What needs to be done?"
            variant="secondary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            fullWidth
            name="name"
            type="text"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Priority
            </span>
            <Select
              aria-label="Priority"
              variant="secondary"
              value={priority}
              onChange={onPriorityChange}
            >
              <SelectTrigger>
                <SelectValue>
                  {() => {
                    const { icon: Icon, color } = PRIORITY_META[priority];
                    return (
                      <span className="flex items-center gap-2">
                        <Icon size={14} className={color} />
                        <span className="capitalize">{priority}</span>
                      </span>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectPopover>
                <ListBox>
                  {PRIORITIES.map((p) => {
                    const { icon: Icon, color } = PRIORITY_META[p];
                    return (
                      <ListBoxItem key={p} id={p} textValue={p}>
                        <span className="flex items-center gap-2">
                          <Icon size={14} className={color} />
                          <span className="capitalize">{p}</span>
                        </span>
                      </ListBoxItem>
                    );
                  })}
                </ListBox>
              </SelectPopover>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Assignee
            </span>
            <Select
              aria-label="Assignee"
              variant="secondary"
              selectedKey={currentAssigneeId ?? UNASSIGNED_KEY}
              onSelectionChange={onAssigneeChange}
            >
              <SelectTrigger>
                <SelectValue>
                  {() =>
                    assignee ? (
                      <span className="flex items-center gap-2">
                        <PersonAvatar person={assignee} size="sm" />
                        <span>{assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-500">Unassigned</span>
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopover>
                <ListBox>
                  <ListBoxItem id={UNASSIGNED_KEY} textValue="Unassigned">
                    <span className="text-neutral-400">Unassigned</span>
                  </ListBoxItem>
                  {PEOPLE.map((person) => (
                    <ListBoxItem key={person.id} id={person.id} textValue={person.name}>
                      <span className="flex items-center gap-2">
                        <PersonAvatar person={person} size="sm" />
                        <span>{person.name}</span>
                      </span>
                    </ListBoxItem>
                  ))}
                </ListBox>
              </SelectPopover>
            </Select>
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Tags
          </span>
          <TagSelect selectedTagIds={currentTagIds} onChange={onTagsChange} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Description
          </span>
          <TextArea
            variant="secondary"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, links, anything..."
            rows={3}
            fullWidth
          />
        </label>
        {isEdit && task && currentSubtasks ? (
          <SubtaskList taskId={task.id} subtasks={currentSubtasks} />
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Subtasks
              </span>
              {draftSubtasks.length > 0 ? (
                <span className="text-xs text-neutral-500">
                  {draftSubtasks.filter((s) => s.done).length} / {draftSubtasks.length}
                </span>
              ) : null}
            </div>
            <ul className="flex flex-col gap-1">
              {draftSubtasks.map((sub) => (
                <SubtaskRow
                  key={sub.id}
                  subtask={sub}
                  onToggle={() => onToggleDraftSubtask(sub.id)}
                  onRename={(text) => onRenameDraftSubtask(sub.id, text)}
                  onRemove={() => onRemoveDraftSubtask(sub.id)}
                />
              ))}
            </ul>
            <input
              type="text"
              placeholder="+ Add subtask..."
              value={draftSubtaskText}
              onChange={(e) => setDraftSubtaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddDraftSubtask();
                }
              }}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className="rounded border border-dashed border-neutral-700 bg-transparent px-2 py-1.5 text-sm text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
            />
          </div>
        )}
      </ModalBody>
      <ModalFooter className="flex justify-end gap-2">
        <Button variant="ghost" onPress={() => onClose()}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" isDisabled={!name.trim()}>
          {isEdit ? 'Save' : 'Add task'}
        </Button>
      </ModalFooter>
    </Form>
  );
}

export function TaskModal({ state, task }: TaskModalProps) {
  return (
    <Modal state={state}>
      <ModalBackdrop className="app-modal-backdrop">
        <ModalContainer placement="center" size="lg">
          <ModalDialog>
            {state.isOpen ? (
              <TaskForm key={task?.id ?? 'new'} task={task} onClose={() => state.close()} />
            ) : null}
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
