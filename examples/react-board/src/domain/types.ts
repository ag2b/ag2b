export type Priority = 'low' | 'medium' | 'high';

export type ColumnId = 'backlog' | 'inProgress' | 'done';

// The selectable palette. Order here is the order shown in color pickers.
// `as const` so it doubles as the source of the TagColor union and a Zod enum.
export const TAG_COLORS = [
  'rose',
  'amber',
  'emerald',
  'sky',
  'violet',
  'fuchsia',
  'neutral',
  'orange',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export type Subtask = {
  id: string;
  text: string;
  done: boolean;
};

export type Tag = {
  id: string;
  name: string;
  color: TagColor;
};

export type Person = {
  id: string;
  name: string;
  initials: string;
  color: TagColor;
};

export type Task = {
  id: string;
  name: string;
  priority: Priority;
  status: ColumnId;
  order: number;
  description: string;
  subtasks: Subtask[];
  tagIds: string[];
  assigneeId: string | null;
};
