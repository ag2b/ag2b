import type { Scope } from '@ag2b/core';
import { useAg2bScopes } from '@ag2b/react';
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { Lightbulb, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';

import { useCapabilitiesStore } from '../../domain/capabilities';
import { useSettingsStore } from '../../domain/settings';
import { useTasksStore } from '../../domain/tasks';

const TIPS = [
  'Ask "show me Sentry tasks" or "filter by Bob" — the assistant drives the filter bar through tools.',
  'Drag a task with unchecked subtasks to Done — or ask the assistant to move it. You’ll get a confirm step. That’s human-in-the-loop.',
];

function describeContent(content: unknown): string {
  if (content === undefined || content === null) return 'none';
  if (Array.isArray(content)) return `${content.length} item${content.length === 1 ? '' : 's'}`;
  if (typeof content === 'object') return 'object';
  if (typeof content === 'string') return content;
  return JSON.stringify(content) ?? 'value';
}

const INJECTION_BADGE: Record<string, string> = {
  system: 'bg-sky-500/15 text-sky-300',
  user: 'bg-amber-500/15 text-amber-300',
};

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={[
        'flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors',
        on ? 'bg-emerald-500/80' : 'bg-neutral-700',
      ].join(' ')}
    >
      <span
        className={[
          'h-4 w-4 rounded-full bg-white transition-transform',
          on ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

// Hover card showing a scope's full resolved context. HeroUI Popover portals the
// content (so the panel's overflow can't clip it); controlled on hover, with a small
// close delay so you can move into it and scroll long contexts.
function ContextPeek({
  label,
  injection,
  json,
  children,
}: {
  label: string;
  injection: string;
  json: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openNow() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function closeSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <PopoverTrigger onMouseEnter={openNow} onMouseLeave={closeSoon}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        isNonModal
        placement="left"
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        className="w-96 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 p-0 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-800/40 px-3 py-2">
          <span className="text-xs font-medium text-neutral-200">{label}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${INJECTION_BADGE[injection] ?? 'bg-neutral-700 text-neutral-300'}`}
          >
            {injection}
          </span>
          <span className="flex-1" />
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">injected</span>
        </div>
        <pre className="max-h-[70vh] overflow-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-neutral-300">
          {json}
        </pre>
      </PopoverContent>
    </Popover>
  );
}

export function SystemPanel() {
  const scopes = useAg2bScopes();
  // Subscribe so the live readouts re-render when injected data or capability
  // toggles change (scope contexts are resolved from these stores during render).
  useTasksStore((s) => s.tasks);
  useSettingsStore((s) => s.tags);
  useCapabilitiesStore((s) => s.scopeEnabled);
  useCapabilitiesStore((s) => s.toolEnabled);

  return (
    <section className="flex min-h-0 min-w-80 flex-1 flex-col rounded-xl border border-violet-900/40 bg-violet-950/5">
      <header className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Sparkles size={14} className="text-violet-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
          System
        </span>
        <span className="text-xs text-neutral-500">what the assistant sees &amp; can do</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pt-1 pb-3">
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-400">
            <Lightbulb size={12} />
            Tips
          </div>
          <ul className="flex flex-col gap-2">
            {TIPS.map((tip) => (
              <li
                key={tip}
                className="rounded-lg border border-neutral-800 bg-neutral-800/30 px-3 py-2 text-xs leading-relaxed text-neutral-500"
              >
                {tip}
              </li>
            ))}
            <li className="rounded-lg border border-neutral-800 bg-neutral-800/30 px-3 py-2 text-xs leading-relaxed text-neutral-500">
              Tools are also exposed over WebMCP.{' '}
              <a
                href="https://ag2b.ai/docs/plugins/webmcp"
                target="_blank"
                rel="noreferrer"
                className="text-violet-300 underline decoration-dotted underline-offset-2 hover:text-violet-200"
              >
                See how to try it
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Scopes &amp; context
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Toggle a scope to grant or revoke it entirely. Toggle a single tool by clicking its
            pill.
          </p>
          <p className="rounded-md border border-emerald-900/40 bg-emerald-950/30 px-2.5 py-1.5 text-[11px] leading-relaxed text-emerald-300/80">
            In a real app you’d drive <code className="font-mono">enabled</code> from app conditions
            (auth, state, etc.)
          </p>
          <ul className="flex flex-col gap-2">
            {scopes.map((scope) => (
              <ScopeCard key={scope.name} scope={scope} />
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}

function ScopeCard({ scope }: { scope: Scope }) {
  const toggleScope = useCapabilitiesStore((s) => s.toggleScope);
  const toggleTool = useCapabilitiesStore((s) => s.toggleTool);

  const enabled = scope.isEnabled();
  const ctx = scope.getContext();

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-800/30 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-neutral-200">{scope.name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${INJECTION_BADGE[scope.injection] ?? 'bg-neutral-700 text-neutral-300'}`}
        >
          {scope.injection}
        </span>
        <span className="flex-1" />
        <Switch
          on={enabled}
          onToggle={() => toggleScope(scope.name)}
          label={`Toggle ${scope.name} scope`}
        />
      </div>

      <div className={enabled ? '' : 'opacity-40'}>
        {ctx?.content !== undefined ? (
          <ContextPeek
            label={ctx.label}
            injection={ctx.injection}
            json={JSON.stringify(ctx.content, null, 2)}
          >
            <p className="inline-block cursor-help text-xs text-neutral-500 underline decoration-dotted underline-offset-2">
              context: <span className="text-neutral-400">{describeContent(ctx.content)}</span>
            </p>
          </ContextPeek>
        ) : (
          <p className="text-xs text-neutral-500">
            context: <span className="text-neutral-400">none</span>
          </p>
        )}

        {scope.tools.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {scope.tools.map((tool) => {
              const on = tool.isEnabled();
              return (
                <button
                  key={tool.name}
                  type="button"
                  aria-pressed={on}
                  title={on ? `Disable ${tool.name}` : `Enable ${tool.name}`}
                  onClick={() => toggleTool(tool.name)}
                  className={[
                    'cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                    on
                      ? 'border-neutral-700 text-neutral-300 hover:border-neutral-600'
                      : 'border-neutral-800 text-neutral-600 line-through hover:text-neutral-500',
                  ].join(' ')}
                >
                  {tool.name}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="mt-1 block text-[10px] text-neutral-600">context-only · no tools</span>
        )}
      </div>
    </li>
  );
}
