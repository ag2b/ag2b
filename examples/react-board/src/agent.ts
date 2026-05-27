import { Agent, AnthropicProvider, createAgent, OpenAiProvider, Scope, Tool } from '@ag2b/core';
import { webmcp } from '@ag2b/plugin-webmcp';
import { z } from 'zod/v4';

import { isScopeEnabled, isToolEnabled } from './domain/capabilities';
import { requestMoveTask } from './domain/confirm-move';
import { hasActiveFilters, matchesFilters, useFiltersStore } from './domain/filters';
import type { ModelSettings } from './domain/model-settings';
import { PEOPLE } from './domain/people';
import { useSettingsStore } from './domain/settings';
import { useTasksStore } from './domain/tasks';
import { TAG_COLORS } from './domain/types';
import { authFetch } from './lib/authFetch';

const SYSTEM_PROMPT =
  "You are a helpful assistant inside a kanban board app. Use addTask to create tasks, updateTask to change a task's fields, and moveTask to move a task between columns or reorder it. Use createTag and deleteTag to manage the tags available to tasks. Use setSearch, filterByTags, filterByAssignees, and clearFilters to control which tasks the user sees on the board.";

const addTask = new Tool({
  name: 'addTask',
  enabled: () => isToolEnabled('addTask'),
  description: 'Create a task. Defaults to the backlog column unless a status is given.',
  parameters: z.object({
    name: z.string().describe('Task title'),
    priority: z.enum(['low', 'medium', 'high']).describe('Task priority'),
    description: z.string().optional().describe('Longer task description'),
    status: z
      .enum(['backlog', 'inProgress', 'done'])
      .optional()
      .describe('Column to place the task in (default backlog)'),
    assigneeId: z
      .string()
      .nullable()
      .optional()
      .describe('Person id to assign, or null for unassigned'),
    tagIds: z.array(z.string()).optional().describe('Tag ids from the available tags context'),
    subtasks: z.array(z.string()).optional().describe('Subtask labels'),
  }),
  handler: (input) => {
    const id = useTasksStore.getState().addTask(input);
    return { status: 'ok', id };
  },
});

const updateTask = new Tool({
  name: 'updateTask',
  enabled: () => isToolEnabled('updateTask'),
  description:
    'Update fields of an existing task. Provide the id and at least one field to change.',
  parameters: z
    .object({
      id: z.string().describe('Task id from the tasks context'),
      name: z.string().optional().describe('New task title'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('New task priority'),
      description: z.string().optional().describe('New task description'),
      assigneeId: z
        .string()
        .nullable()
        .optional()
        .describe('Person id to assign, or null to unassign'),
      tagIds: z
        .array(z.string())
        .optional()
        .describe("Replaces the task's tags with these tag ids"),
    })
    .refine((p) => Object.keys(p).some((k) => k !== 'id' && p[k as keyof typeof p] !== undefined), {
      message: 'Provide at least one field to change',
    }),
  handler: ({ id, ...patch }) => {
    useTasksStore.getState().updateTask(id, patch);
    return { status: 'ok', id };
  },
});

const moveTask = new Tool({
  name: 'moveTask',
  enabled: () => isToolEnabled('moveTask'),
  description:
    'Move a task to a different column and/or position. toIndex is the 0-based position within the target column; pass a large number to append to the end. Moving a task with incomplete subtasks to Done asks the user to confirm first.',
  parameters: z.object({
    id: z.string().describe('Task id from the tasks context'),
    toStatus: z.enum(['backlog', 'inProgress', 'done']).describe('Target column'),
    toIndex: z.number().int().min(0).describe('0-based position within the target column'),
  }),
  handler: async ({ id, toStatus, toIndex }) => {
    const { moved } = await requestMoveTask(id, toStatus, toIndex);
    if (!moved) {
      return {
        status: 'cancelled',
        id,
        message: 'The user cancelled the move; the task has incomplete subtasks and stays put.',
      };
    }
    return { status: 'ok', id, toStatus, toIndex };
  },
});

const tasksScope = new Scope({
  name: 'tasks',
  enabled: () => isScopeEnabled('tasks'),
  tools: [addTask, updateTask, moveTask],
  injection: 'user',
  label: 'Current tasks with their ids',
  context: () =>
    useTasksStore.getState().tasks.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      order: t.order,
      priority: t.priority,
      assigneeId: t.assigneeId,
      tagIds: t.tagIds,
    })),
});

// Context-only scope: no tools, just the roster so the model can map assignee ids
// (e.g. "p1") to names (e.g. "Alice") when reading, assigning, or filtering tasks.
const peopleScope = new Scope({
  name: 'people',
  enabled: () => isScopeEnabled('people'),
  tools: [],
  injection: 'system',
  label: 'Team members and their assignee ids',
  context: () => PEOPLE.map((p) => ({ id: p.id, name: p.name })),
});

const createTag = new Tool({
  name: 'createTag',
  enabled: () => isToolEnabled('createTag'),
  description: 'Create a new tag that tasks can be labelled with.',
  parameters: z.object({
    name: z.string().describe('Tag label'),
    color: z.enum(TAG_COLORS).describe('Tag color'),
  }),
  handler: ({ name, color }) => {
    const id = useSettingsStore.getState().createTag({ name, color });
    return { status: 'ok', id, name, color };
  },
});

const deleteTag = new Tool({
  name: 'deleteTag',
  enabled: () => isToolEnabled('deleteTag'),
  description: 'Delete a tag by id. It is also removed from any tasks that had it.',
  parameters: z.object({
    id: z.string().describe('Tag id from the available tags context'),
  }),
  handler: ({ id }) => {
    useSettingsStore.getState().deleteTag(id);
    return { status: 'ok', id };
  },
});

const tagsScope = new Scope({
  name: 'tags',
  enabled: () => isScopeEnabled('tags'),
  tools: [createTag, deleteTag],
  injection: 'system',
  label: 'Available tags',
  context: () =>
    useSettingsStore.getState().tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),
});

const setSearch = new Tool({
  name: 'setSearch',
  enabled: () => isToolEnabled('setSearch'),
  description:
    'Set the board text search filter (matches a task title or description). Pass an empty string to clear it.',
  parameters: z.object({ text: z.string().describe('Search text; empty to clear') }),
  handler: ({ text }) => {
    useFiltersStore.getState().setText(text);
    return { status: 'ok', text };
  },
});

const filterByTags = new Tool({
  name: 'filterByTags',
  enabled: () => isToolEnabled('filterByTags'),
  description:
    'Show only tasks that have at least one of these tag ids. Pass an empty array to clear the tag filter.',
  parameters: z.object({
    tagIds: z.array(z.string()).describe('Tag ids from the available tags context'),
  }),
  handler: ({ tagIds }) => {
    useFiltersStore.getState().setTagIds(tagIds);
    return { status: 'ok', tagIds };
  },
});

const filterByAssignees = new Tool({
  name: 'filterByAssignees',
  enabled: () => isToolEnabled('filterByAssignees'),
  description:
    'Show only tasks assigned to one of these people. Use null for unassigned. Pass an empty array to clear the assignee filter.',
  parameters: z.object({
    assigneeIds: z
      .array(z.string().nullable())
      .describe('Person ids, or null for unassigned tasks'),
  }),
  handler: ({ assigneeIds }) => {
    useFiltersStore.getState().setAssigneeIds(assigneeIds);
    return { status: 'ok', assigneeIds };
  },
});

const clearFilters = new Tool({
  name: 'clearFilters',
  enabled: () => isToolEnabled('clearFilters'),
  description: 'Clear all board filters (search, tags, assignees).',
  parameters: z.object({}),
  handler: () => {
    useFiltersStore.getState().clear();
    return { status: 'ok' };
  },
});

const filtersScope = new Scope({
  name: 'filters',
  enabled: () => isScopeEnabled('filters'),
  tools: [setSearch, filterByTags, filterByAssignees, clearFilters],
  injection: 'user',
  label: 'Active board filters',
  context: () => {
    const filters = useFiltersStore.getState();
    const tasks = useTasksStore.getState().tasks;
    const visible = tasks.filter((t) => matchesFilters(t, filters)).length;
    return {
      text: filters.text,
      tagIds: filters.tagIds,
      assigneeIds: filters.assigneeIds,
      note: hasActiveFilters(filters)
        ? `Filters are active: the user currently sees only ${visible} of ${tasks.length} tasks on the board. The full task list is still available in the tasks context.`
        : 'No filters active: the user sees all tasks.',
    };
  },
});

export function createBoardAgent(settings: ModelSettings): Agent {
  const fetcher = authFetch(settings);
  const provider =
    settings.provider === 'anthropic'
      ? new AnthropicProvider({
          baseURL: settings.baseURL,
          ...(settings.model ? { model: settings.model } : {}),
          maxTokens: 4096,
          thinking: { budgetTokens: 1024, enabled: true },
          fetch: fetcher,
        })
      : new OpenAiProvider({
          baseURL: settings.baseURL,
          ...(settings.model ? { model: settings.model } : {}),
          fetch: fetcher,
        });

  const agent = createAgent({ provider, system: SYSTEM_PROMPT });
  agent.scopes.register(peopleScope);
  agent.scopes.register(tagsScope);
  agent.scopes.register(tasksScope);
  agent.scopes.register(filtersScope);

  void agent.use(webmcp());
  return agent;
}
