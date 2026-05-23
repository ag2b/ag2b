import type { Ag2bPopupMode } from '@/types';

import styles from './Header.module.css';

type HeaderProps = {
  mode: Ag2bPopupMode;
  onModeChange: (mode: Ag2bPopupMode) => void;
  onClose: () => void;
  showModeToggle: boolean;
  className?: string;
};

export const Header = ({ mode, onModeChange, onClose, showModeToggle, className }: HeaderProps) => (
  <div className={[styles.header, className].filter(Boolean).join(' ')}>
    <span className={styles.title}>Chat</span>
    {showModeToggle ? (
      <button
        type="button"
        aria-label={`Mode: ${mode}`}
        className={styles.button}
        onClick={() => onModeChange(mode === 'streaming' ? 'synchronous' : 'streaming')}
      >
        {mode}
      </button>
    ) : null}
    <button type="button" aria-label="Close chat" className={styles.closeButton} onClick={onClose}>
      ✕
    </button>
  </div>
);
