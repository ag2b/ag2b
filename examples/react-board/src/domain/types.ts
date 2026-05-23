export type Priority = 'low' | 'medium' | 'high';

export type ColumnId = 'backlog' | 'inProgress' | 'review' | 'done';

export type TagColor =
  | 'rose'
  | 'amber'
  | 'emerald'
  | 'sky'
  | 'violet'
  | 'fuchsia'
  | 'neutral'
  | 'orange';

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
