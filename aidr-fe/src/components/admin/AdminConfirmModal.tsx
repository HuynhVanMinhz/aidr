import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ConfirmVariant = 'primary' | 'success' | 'warning' | 'danger';

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const confirmBtnClass: Record<ConfirmVariant, string> = {
  primary: 'btn btn-primary',
  success: 'btn btn-success',
  warning: 'btn btn-warning',
  danger: 'btn btn-danger',
};

export function AdminConfirmModal({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  confirming = false,
  onConfirm,
  onCancel,
}: AdminConfirmModalProps) {
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

  return createPortal(
    <>
      <div
        className="modal-backdrop fade show"
        onClick={() => {
          if (!confirming) onCancel();
        }}
      />
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-modal-title"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="admin-confirm-modal-title">
                {title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                disabled={confirming}
                onClick={onCancel}
              />
            </div>
            <div className="modal-body">{children}</div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-light"
                disabled={confirming}
                onClick={onCancel}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={confirmBtnClass[confirmVariant]}
                disabled={confirming}
                onClick={onConfirm}
              >
                {confirming ? 'Please wait...' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
