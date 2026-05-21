import type { ChatMessage } from '@/messages';
import type { ScopeContext } from '@/scope';

export type InlineScopeContextsResult = {
  messages: ChatMessage[];
  system: string | undefined;
};

/**
 * Flattens scope contexts into the request's `messages` and `system`.
 *
 * - `'system'` contexts are appended to the base system prompt.
 * - `'user'` contexts are appended to the LAST user message in `messages`.
 *   If no user message exists, the messages array is returned unchanged
 *   (no synthetic message is inserted).
 *
 * Pure — never mutates `messages`, `system`, or `contexts`. Returns a new
 * messages array only when a `'user'` context was injected.
 */
export function inlineScopeContexts(
  contexts: ScopeContext[],
  messages: ChatMessage[],
  system?: string
): InlineScopeContextsResult {
  if (contexts.length === 0) return { messages, system };

  const systemContexts: ScopeContext[] = [];
  const userContexts: ScopeContext[] = [];

  for (const ctx of contexts) {
    switch (ctx.injection) {
      case 'system':
        systemContexts.push(ctx);
        break;
      case 'user':
        userContexts.push(ctx);
        break;
    }
  }

  const renderedSystem = formatContexts(systemContexts);
  const renderedUser = formatContexts(userContexts);

  return {
    messages: renderedUser ? appendToLastUser(messages, renderedUser) : messages,
    system: composeSystem(system, renderedSystem),
  };
}

function composeSystem(base: string | undefined, scoped: string): string | undefined {
  if (!scoped) return base;
  return base ? `${base}\n\n${scoped}` : scoped;
}

function formatContexts(contexts: ScopeContext[]): string {
  const parts: string[] = [];
  for (const c of contexts) {
    const text = serializeContent(c.content);
    if (text !== undefined) parts.push(`## ${c.label}\n${text}`);
  }
  return parts.join('\n\n');
}

function serializeContent(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function appendToLastUser(messages: ChatMessage[], rendered: string): ChatMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === 'user') {
      return [
        ...messages.slice(0, i),
        {
          ...msg,
          content: msg.content ? `${msg.content}\n\n${rendered}` : rendered,
        },
        ...messages.slice(i + 1),
      ];
    }
  }
  return messages;
}
