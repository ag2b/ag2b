import type { AssistantToolCall, ToolMessage } from '@ag2b/core';
import { useState } from 'react';

import styles from './ToolCallBadge.module.css';

type Status = 'running' | 'done' | 'error';

type ToolCallBadgeProps = {
  call: AssistantToolCall;
  toolMessage: ToolMessage | undefined;
  className?: string;
};

const parseContent = (content: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(content) as unknown };
  } catch {
    return { ok: false };
  }
};

const isErrorPayload = (value: unknown): value is { error: unknown } =>
  typeof value === 'object' && value !== null && 'error' in value;

const computeStatus = (toolMessage: ToolMessage | undefined): Status => {
  if (!toolMessage) return 'running';
  const parsed = parseContent(toolMessage.content);
  if (parsed.ok && isErrorPayload(parsed.value)) return 'error';
  return 'done';
};

const STATUS_ICON: Record<Status, string> = {
  running: '⏳',
  done: '✓',
  error: '✕',
};

export const ToolCallBadge = ({ call, toolMessage, className }: ToolCallBadgeProps) => {
  const [open, setOpen] = useState(false);
  const status = computeStatus(toolMessage);

  const parsed = toolMessage ? parseContent(toolMessage.content) : undefined;
  const errorValue = parsed?.ok && isErrorPayload(parsed.value) ? parsed.value.error : undefined;

  return (
    <div className={[styles.badge, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={`${styles.icon} ${status === 'error' ? styles.error : ''}`}>
          {STATUS_ICON[status]}
        </span>
        <span className={styles.name}>{call.name}</span>
        <span className={styles.status}>· {status}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▸</span>
      </button>
      {open ? (
        <div className={styles.details}>
          <div className={styles.label}>args</div>
          <pre className={styles.code}>{JSON.stringify(call.arguments, null, 2)}</pre>
          {toolMessage ? (
            status === 'error' ? (
              <>
                <div className={styles.label}>error</div>
                <pre className={`${styles.code} ${styles.errorBlock}`}>
                  {typeof errorValue === 'string'
                    ? errorValue
                    : JSON.stringify(errorValue, null, 2)}
                </pre>
              </>
            ) : (
              <>
                <div className={styles.label}>result</div>
                <pre className={styles.code}>
                  {parsed?.ok ? JSON.stringify(parsed.value, null, 2) : toolMessage.content}
                </pre>
              </>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
