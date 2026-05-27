import type { ColumnId } from './types';

export const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'inProgress', label: 'In-Progress' },
  { id: 'done', label: 'Done' },
] as const satisfies readonly { id: ColumnId; label: string }[];

export const COLUMN_IDS: readonly ColumnId[] = COLUMNS.map((c) => c.id);
