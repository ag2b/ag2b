export type Ag2bPopupPlacement = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export type Ag2bPopupMode = 'streaming' | 'synchronous';

export type Ag2bPopupClassNames = {
  fab?: string;
  panel?: string;
  header?: string;
  body?: string;
  message?: string;
  userMessage?: string;
  assistantMessage?: string;
  toolCall?: string;
  reasoning?: string;
  composer?: string;
  textarea?: string;
  sendButton?: string;
  stopButton?: string;
};

export type Ag2bPopupProps = {
  placement?: Ag2bPopupPlacement;
  mode?: Ag2bPopupMode;
  showModeToggle?: boolean;
  showReasoning?: boolean;
  placeholder?: string;
  classNames?: Ag2bPopupClassNames;
};
