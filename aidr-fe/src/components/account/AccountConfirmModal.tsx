import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalVariant = 'default' | 'danger' | 'warning';

type AccountConfirmModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When false, only a single dismiss button is shown (alert / info). */
  showConfirm?: boolean;
  confirmVariant?: ModalVariant;
  confirming?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
};

export function AccountConfirmModal({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  showConfirm = true,
  confirmVariant = 'default',
  confirming = false,
  onConfirm,
  onCancel,
}: AccountConfirmModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) onCancel();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, confirming, onCancel]);

  if (!open) return null;

  const confirmClass =
    confirmVariant === 'danger'
      ? 'account-btn account-btn--danger'
      : confirmVariant === 'warning'
        ? 'account-btn account-btn--secondary'
        : 'account-btn account-btn--primary';

  return createPortal(
    <div className="account-modal" role="presentation">
      <button
        type="button"
        className="account-modal__backdrop"
        aria-label="Close dialog"
        disabled={confirming}
        onClick={() => {
          if (!confirming) onCancel();
        }}
      />
      <div
        className="account-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-confirm-modal-title"
      >
        <header className="account-modal__header">
          <h2 className="account-modal__title" id="account-confirm-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="account-modal__close"
            aria-label="Close"
            disabled={confirming}
            onClick={onCancel}
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </header>
        <div className="account-modal__body">{children}</div>
        <footer className="account-modal__footer">
          {showConfirm ? (
            <>
              <button
                type="button"
                className="account-btn account-btn--secondary"
                disabled={confirming}
                onClick={onCancel}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={confirmClass}
                disabled={confirming || !onConfirm}
                onClick={onConfirm}
              >
                {confirming ? 'Please wait…' : confirmLabel}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="account-btn account-btn--primary"
              onClick={onCancel}
            >
              {cancelLabel === 'Cancel' ? 'OK' : cancelLabel}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
