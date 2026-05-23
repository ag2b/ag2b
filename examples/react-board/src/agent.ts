import { createAgent, OpenAiProvider, Scope, Tool } from '@ag2b/core';
import { webmcp } from '@ag2b/plugin-webmcp';
import { z } from 'zod/v4';

import { useBoardStore } from './domain/store';

const addTask = new Tool({
  name: 'addTask',
  description: 'Add a new task to the backlog column.',
  parameters: z.object({
    name: z.string().describe('Short task title'),
    priority: z.enum(['low', 'medium', 'high']).describe('Task priority'),
  }),
  handler: ({ name, priority }) => {
    const id = useBoardStore.getState().addTask({ name, priority });
    return { id, name, priority };
  },
});

const updateTask = new Tool({
  name: 'updateTask',
  description:
    'Update an existing task. Provide the task id and at least one field to change (name, priority, or description).',
  parameters: z
    .object({
      id: z.string().describe('Task id from the board context'),
      name: z.string().optional().describe('New task title'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('New task priority'),
      description: z.string().optional().describe('New task description'),
    })
    .refine(
      (p) => p.name !== undefined || p.priority !== undefined || p.description !== undefined,
      {
        message: 'Provide at least one of: name, priority, description',
      }
    ),
  handler: ({ id, name, priority, description }) => {
    const { tasks, updateTask: update } = useBoardStore.getState();
    if (!tasks.some((t) => t.id === id)) {
      throw new Error(`No task with id "${id}"`);
    }
    const patch = {
      ...(name !== undefined && { name }),
      ...(priority !== undefined && { priority }),
      ...(description !== undefined && { description }),
    };
    update(id, patch);
    return { id, patch };
  },
});

const moveTask = new Tool({
  name: 'moveTask',
  description:
    'Move a task to a different column and/or position. toIndex is the 0-based position within the target column; pass a large number to append to the end.',
  parameters: z.object({
    id: z.string().describe('Task id from the board context'),
    toStatus: z.enum(['backlog', 'inProgress', 'review', 'done']).describe('Target column'),
    toIndex: z.number().int().min(0).describe('0-based position within the target column'),
  }),
  handler: ({ id, toStatus, toIndex }) => {
    const { tasks, moveTask: move } = useBoardStore.getState();
    if (!tasks.some((t) => t.id === id)) {
      throw new Error(`No task with id "${id}"`);
    }
    move(id, toStatus, toIndex);
    return { id, toStatus, toIndex };
  },
});

const boardScope = new Scope({
  name: 'board',
  tools: [addTask, updateTask, moveTask],
  injection: 'user',
  label: 'Current tasks with their ids, status, and order',
  context: () =>
    useBoardStore.getState().tasks.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      order: t.order,
      priority: t.priority,
    })),
});

export const agent = createAgent({
  provider: new OpenAiProvider({ baseURL: '/api/llm' }),
  system:
    "You are a helpful assistant inside a kanban board app. Use addTask to create tasks, updateTask to change a task's name, priority, or description, and moveTask to move a task between columns or reorder it.",
});

agent.scopes.register(boardScope);

void agent.use(webmcp());
