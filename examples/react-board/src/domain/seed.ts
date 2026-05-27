import { PEOPLE } from './people';
import type { ColumnId, Priority, Subtask, Tag, Task } from './types';

// Stable ids so the seeded tasks can reference the seeded tags without
// coordinating random ids across the tasks and settings stores.
export const TAG_BUG = 'preset-bug';
export const TAG_FEATURE = 'preset-feature';

export const SEED_TAGS: Tag[] = [
  { id: TAG_BUG, name: 'bug', color: 'rose' },
  { id: TAG_FEATURE, name: 'feature', color: 'emerald' },
];

type TaskSeed = {
  name: string;
  priority: Priority;
  assignee: string | null;
  subtasks?: string[];
  tags?: string[];
};

// Ordering matters: index % 3 maps to backlog / inProgress / done, and done-column
// tasks get all subtasks auto-completed. Tasks with subtasks are placed so they land
// in backlog/inProgress (incomplete) — that's what the HITL "move to Done" gate needs.
const TASK_SEEDS: TaskSeed[] = [
  {
    name: 'Refactor auth middleware',
    priority: 'high',
    assignee: 'p1',
    subtasks: ['Audit current claims', 'Migrate to JWT', 'Update tests'],
  },
  {
    name: 'Investigate flaky CI run',
    priority: 'high',
    assignee: 'p2',
    subtasks: ['Reproduce locally', 'Add retry counter'],
    tags: [TAG_BUG],
  },
  {
    name: 'Add empty-state illustrations',
    priority: 'medium',
    assignee: 'p4',
    tags: [TAG_FEATURE],
  },
  {
    name: 'Fix mobile nav overlap on iOS Safari',
    priority: 'high',
    assignee: 'p1',
    tags: [TAG_BUG],
  },
  {
    name: 'Wire up Sentry',
    priority: 'medium',
    assignee: 'p2',
    subtasks: ['Create project', 'Add SDK', 'Verify in staging'],
  },
  { name: 'Add dark mode toggle', priority: 'low', assignee: null, tags: [TAG_FEATURE] },
  {
    name: 'Cache provider responses',
    priority: 'high',
    assignee: 'p1',
    subtasks: ['Design key shape', 'Add LRU', 'Invalidate on 401'],
  },
  {
    name: 'Add keyboard shortcuts overlay',
    priority: 'medium',
    assignee: 'p5',
    subtasks: ['Pick shortcut library', 'Design overlay'],
    tags: [TAG_FEATURE],
  },
  {
    name: 'Tooltip flickers on hover in Firefox',
    priority: 'low',
    assignee: null,
    tags: [TAG_BUG],
  },
  { name: 'Triage stale PRs', priority: 'low', assignee: 'p3' },
];

const SEED_STATUSES: ColumnId[] = ['backlog', 'inProgress', 'done'];

function seedSubtasks(texts: string[] | undefined, allDone: boolean): Subtask[] {
  if (!texts) return [];
  return texts.map((text, i) => ({
    id: crypto.randomUUID(),
    text,
    // Done-column tasks have everything checked off (invariant: done == all subtasks complete).
    // Otherwise mark the first as done so the card chip shows partial progress.
    done: allDone || (texts.length > 1 && i === 0),
  }));
}

export function seedTasks(): Task[] {
  return TASK_SEEDS.map((seed, i) => {
    const status = SEED_STATUSES[i % SEED_STATUSES.length]!;
    return {
      id: crypto.randomUUID(),
      name: seed.name,
      priority: seed.priority,
      status,
      order: Math.floor(i / SEED_STATUSES.length),
      description: '',
      subtasks: seedSubtasks(seed.subtasks, status === 'done'),
      tagIds: seed.tags ?? [],
      assigneeId:
        seed.assignee && PEOPLE.some((p) => p.id === seed.assignee) ? seed.assignee : null,
    };
  });
}
