import { useAg2bHistory } from '@ag2b/react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Fab } from '@/components/Fab';
import { Panel } from '@/components/Panel';
import { useChatController } from '@/hooks/useChatController';
import type { Ag2bPopupMode, Ag2bPopupProps } from '@/types';

export const Ag2bPopup = ({
  placement = 'bottom-right',
  mode: initialMode = 'streaming',
  showModeToggle = false,
  showReasoning = false,
  placeholder,
  classNames,
}: Ag2bPopupProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Ag2bPopupMode>(initialMode);
  const panelId = useId();
  const fabRef = useRef<HTMLDivElement>(null);

  const history = useAg2bHistory();
  const controller = useChatController({ mode });

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => {
      fabRef.current?.querySelector('button')?.focus();
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const panel = document.getElementById(panelId);
      const fab = fabRef.current;
      const target = e.target as Node | null;
      if (!target) return;
      if (panel?.contains(target)) return;
      if (fab?.contains(target)) return;
      close();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open, panelId, close]);

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
              showReasoning={showReasoning}
              onModeChange={setMode}
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
