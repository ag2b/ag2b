import type { AssistantMessage, ChatMessage } from '@ag2b/core';

import type { Ag2bPopupClassNames, Ag2bPopupMode, Ag2bPopupPlacement } from '@/types';

import { Composer } from './Composer';
import { ErrorBanner } from './ErrorBanner';
import { Header } from './Header';
import { MessageList } from './MessageList';

import styles from './Panel.module.css';

const PLACEMENT_CLASS: Record<Ag2bPopupPlacement, string> = {
  'bottom-right': styles.bottomRight,
  'bottom-left': styles.bottomLeft,
  'top-right': styles.topRight,
  'top-left': styles.topLeft,
};

type PanelProps = {
  panelId: string;
  placement: Ag2bPopupPlacement;
  mode: Ag2bPopupMode;
  showModeToggle: boolean;
  showClearChat: boolean;
  showReasoning: boolean;
  onModeChange: (mode: Ag2bPopupMode) => void;
  onClearChat: () => void;
  onClose: () => void;
  onSend: (message: string) => void;
  onAbort: () => void;
  isPending: boolean;
  error: unknown;
  messages: readonly ChatMessage[];
  pendingMessage: AssistantMessage | null;
  placeholder?: string;
  classNames?: Ag2bPopupClassNames;
};

export const Panel = ({
  panelId,
  placement,
  mode,
  showModeToggle,
  showClearChat,
  showReasoning,
  onModeChange,
  onClearChat,
  onClose,
  onSend,
  onAbort,
  isPending,
  error,
  messages,
  pendingMessage,
  placeholder,
  classNames,
}: PanelProps) => (
  <div
    id={panelId}
    role="dialog"
    aria-modal="false"
    className={[styles.panel, PLACEMENT_CLASS[placement], classNames?.panel]
      .filter(Boolean)
      .join(' ')}
  >
    <Header
      mode={mode}
      onModeChange={onModeChange}
      onClose={onClose}
      onClearChat={onClearChat}
      showModeToggle={showModeToggle}
      showClearChat={showClearChat}
      clearDisabled={isPending || messages.length === 0}
      className={classNames?.header}
    />
    <MessageList
      messages={messages}
      pendingMessage={pendingMessage}
      showReasoning={showReasoning}
      classNames={classNames}
    />
    <ErrorBanner error={error} />
    <Composer
      onSend={onSend}
      onAbort={onAbort}
      isPending={isPending}
      placeholder={placeholder}
      classNames={classNames}
    />
  </div>
);
