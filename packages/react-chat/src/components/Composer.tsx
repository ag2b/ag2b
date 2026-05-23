import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import styles from './Composer.module.css';

type ComposerProps = {
  onSend: (message: string) => void;
  onAbort: () => void;
  isPending: boolean;
  placeholder?: string;
  classNames?: {
    composer?: string;
    textarea?: string;
    sendButton?: string;
    stopButton?: string;
  };
};

export const Composer = ({
  onSend,
  onAbort,
  isPending,
  placeholder = 'Type a message…',
  classNames,
}: ComposerProps) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isPending) return;
    onSend(trimmed);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={[styles.composer, classNames?.composer].filter(Boolean).join(' ')}>
      <textarea
        ref={textareaRef}
        className={[styles.textarea, classNames?.textarea].filter(Boolean).join(' ')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={isPending}
        rows={1}
      />
      {isPending ? (
        <button
          type="button"
          aria-label="Stop"
          className={[styles.button, styles.stop, classNames?.stopButton].filter(Boolean).join(' ')}
          onClick={onAbort}
        >
          ◼
        </button>
      ) : (
        <button
          type="button"
          aria-label="Send"
          className={[styles.button, classNames?.sendButton].filter(Boolean).join(' ')}
          onClick={submit}
          disabled={!value.trim()}
        >
          ▶
        </button>
      )}
    </div>
  );
};
