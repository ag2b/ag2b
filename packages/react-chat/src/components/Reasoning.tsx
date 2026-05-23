import { useState } from 'react';

import styles from './Reasoning.module.css';

type ReasoningProps = {
  text: string;
  pending: boolean;
  className?: string;
};

export const Reasoning = ({ text, pending, className }: ReasoningProps) => {
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const open = userChoice ?? pending;

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setUserChoice(!open)}
      >
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▸</span>
        <span>Thinking</span>
      </button>
      {open ? <div className={styles.body}>{text}</div> : null}
    </div>
  );
};
