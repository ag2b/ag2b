import type { Ag2bPopupMode } from '@/types';

import styles from './Header.module.css';

type HeaderProps = {
  mode: Ag2bPopupMode;
  onModeChange: (mode: Ag2bPopupMode) => void;
  onClearChat: () => void;
  onClose: () => void;
  showModeToggle: boolean;
  showClearChat: boolean;
  clearDisabled: boolean;
  className?: string;
};

function ClearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export const Header = ({
  mode,
  onModeChange,
  onClearChat,
  onClose,
  showModeToggle,
  showClearChat,
  clearDisabled,
  className,
}: HeaderProps) => (
  <div className={[styles.header, className].filter(Boolean).join(' ')}>
    <span className={styles.title}>Chat</span>
    <span className={styles.spacer} />
    {showModeToggle ? (
      <button
        type="button"
        role="switch"
        aria-checked={mode === 'streaming'}
        aria-label="Stream responses"
        className={styles.modeToggle}
        onClick={() => onModeChange(mode === 'streaming' ? 'synchronous' : 'streaming')}
      >
        <span>Stream</span>
        <span
          className={[styles.switchTrack, mode === 'streaming' ? styles.switchTrackOn : '']
            .filter(Boolean)
            .join(' ')}
        >
          <span
            className={[styles.switchKnob, mode === 'streaming' ? styles.switchKnobOn : '']
              .filter(Boolean)
              .join(' ')}
          />
        </span>
      </button>
    ) : null}
    {showClearChat ? (
      <button
        type="button"
        aria-label="Clear chat"
        className={styles.clearButton}
        onClick={onClearChat}
        disabled={clearDisabled}
      >
        <ClearIcon />
      </button>
    ) : null}
    <button type="button" aria-label="Close chat" className={styles.closeButton} onClick={onClose}>
      ✕
    </button>
  </div>
);
