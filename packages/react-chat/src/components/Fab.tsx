import type { Ag2bPopupPlacement } from '@/types';

import { LogoMark } from './LogoMark';

import styles from './Fab.module.css';

const PLACEMENT_CLASS: Record<Ag2bPopupPlacement, string> = {
  'bottom-right': styles.bottomRight,
  'bottom-left': styles.bottomLeft,
  'top-right': styles.topRight,
  'top-left': styles.topLeft,
};

type FabProps = {
  placement: Ag2bPopupPlacement;
  open: boolean;
  onClick: () => void;
  panelId: string;
  className?: string;
};

export const Fab = ({ placement, open, onClick, panelId, className }: FabProps) => (
  <button
    type="button"
    aria-label={open ? 'Close chat' : 'Open chat'}
    aria-expanded={open}
    aria-controls={panelId}
    className={[styles.fab, PLACEMENT_CLASS[placement], className].filter(Boolean).join(' ')}
    onClick={onClick}
  >
    {open ? <span aria-hidden>✕</span> : <LogoMark size={24} />}
  </button>
);
