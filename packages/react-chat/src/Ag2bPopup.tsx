import { useAg2bAgent, useAg2bHistory } from '@ag2b/react';
import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Fab } from '@/components/Fab';
import { Panel } from '@/components/Panel';
import { useChatController } from '@/hooks/useChatController';
import type { Ag2bPopupMode, Ag2bPopupProps } from '@/types';

export const Ag2bPopup = ({
  placement = 'bottom-right',
  mode: initialMode = 'streaming',
  showModeToggle = false,
  showClearChat = false,
  showReasoning = false,
  placeholder,
  classNames,
}: Ag2bPopupProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Ag2bPopupMode>(initialMode);
  const panelId = useId();
  const fabRef = useRef<HTMLDivElement>(null);

  const agent = useAg2bAgent();
  const history = useAg2bHistory();
  const controller = useChatController({ mode });

  const clearChat = useCallback(() => agent.history.reset(), [agent]);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => {
      fabRef.current?.querySelector('button')?.focus();
    });
  }, []);

  return (
    <>
      <div ref={fabRef}>
        <Fab
          placement={placement}
          open={open}
          onClick={() => setOpen((o) => !o)}
          panelId={panelId}
          className={classNames?.fab}
        />
      </div>
      {open
        ? createPortal(
            <Panel
              panelId={panelId}
              placement={placement}
              mode={mode}
              showModeToggle={showModeToggle}
              showClearChat={showClearChat}
              showReasoning={showReasoning}
              onModeChange={setMode}
              onClearChat={clearChat}
              onClose={close}
              onSend={(msg) => {
                void controller.send(msg);
              }}
              onAbort={controller.abort}
              isPending={controller.isPending}
              error={controller.error}
              messages={history}
              pendingMessage={controller.pendingMessage}
              placeholder={placeholder}
              classNames={classNames}
            />,
            document.body
          )
        : null}
    </>
  );
};
