import {
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
  type useOverlayState,
} from '@heroui/react';
import { useMemo } from 'react';

import { useConfirmMoveStore } from '../../domain/confirm-move';

type OverlayState = ReturnType<typeof useOverlayState>;

// Gate shown when a task with incomplete subtasks is moved to Done — by drag or by
// the agent. Open state is driven entirely by the store's pending request.
export function MoveConfirmModal() {
  const pending = useConfirmMoveStore((s) => s.pending);
  const confirm = useConfirmMoveStore((s) => s.confirm);
  const cancel = useConfirmMoveStore((s) => s.cancel);

  // Controlled state object: open while a request is pending; any dismissal cancels.
  const state = useMemo<OverlayState>(
    () => ({
      isOpen: pending !== null,
      setOpen: (open: boolean) => {
        if (!open) cancel();
      },
      open: () => {
        /* opening is driven by the confirm-move store, not the modal */
      },
      close: cancel,
      toggle: () => {
        /* not used — open state is controlled externally */
      },
    }),
    [pending, cancel]
  );

  const count = pending?.incompleteCount ?? 0;

  return (
    <Modal state={state}>
      <ModalBackdrop className="app-modal-backdrop">
        <ModalContainer placement="center" size="md">
          <ModalDialog>
            <ModalHeader>
              <ModalHeading className="text-base font-semibold">Incomplete subtasks</ModalHeading>
            </ModalHeader>
            <ModalBody className="p-1">
              <p className="text-sm text-neutral-300">
                <span className="font-medium text-neutral-100">{pending?.taskName}</span> has{' '}
                {count} incomplete subtask{count === 1 ? '' : 's'}. A task can only be marked Done
                once every subtask is complete.
              </p>
            </ModalBody>
            <ModalFooter className="flex justify-end gap-2">
              <Button variant="ghost" onPress={() => cancel()}>
                Cancel
              </Button>
              <Button variant="primary" onPress={() => confirm()}>
                Complete all & move
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
