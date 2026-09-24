import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatDateTime, formatVnd } from '../../utils/sellerProductUi';

export type StockVoucherKind = 'in' | 'out';

export type StockVoucherRow = {
  label: string;
  value: string;
};

type StockVoucherModalProps = {
  open: boolean;
  kind: StockVoucherKind;
  title: string;
  productName: string;
  voucherCode: string;
  occurredAt: string;
  rows: StockVoucherRow[];
  note?: string | null;
  onClose: () => void;
};

const PRINT_BODY_CLASS = 'is-printing-stock-voucher';

export function StockVoucherModal({
  open,
  kind,
  title,
  productName,
  voucherCode,
  occurredAt,
  rows,
  note,
  onClose,
}: StockVoucherModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const clearPrintClass = () => {
      document.body.classList.remove(PRINT_BODY_CLASS);
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('afterprint', clearPrintClass);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('afterprint', clearPrintClass);
      document.body.style.overflow = previous;
      clearPrintClass();
    };
  }, [open, onClose]);

  function handlePrint() {
    document.body.classList.add(PRINT_BODY_CLASS);
    // Let the browser apply print styles before opening the dialog.
    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  if (!open) return null;

  return createPortal(
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content stock-voucher">
            <div className="modal-header no-print">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="stock-voucher__sheet" id="stock-voucher-print">
                <header className="stock-voucher__header">
                  <div>
                    <p className="stock-voucher__brand">AIDR Seller</p>
                    <p className="stock-voucher__doc">
                      {kind === 'in' ? 'Stock-in voucher' : 'Stock-out voucher'}
                    </p>
                  </div>
                  <div className="stock-voucher__meta">
                    <p>
                      <span>Code</span>
                      <strong>{voucherCode}</strong>
                    </p>
                    <p>
                      <span>Date</span>
                      <strong>{formatDateTime(occurredAt)}</strong>
                    </p>
                  </div>
                </header>

                <p className="stock-voucher__product">
                  <span>Product</span>
                  <strong>{productName}</strong>
                </p>

                <table className="stock-voucher__table">
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <th>{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {note ? (
                  <p className="stock-voucher__note">
                    <strong>Note:</strong> {note}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="modal-footer no-print">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={handlePrint}>
                Print voucher
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function moneyOrDash(value: number | null | undefined) {
  return value == null ? '-' : formatVnd(value);
}

export function StockVoucherTrigger({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): ReactNode {
  return (
    <button type="button" className="btn btn-light btn-sm" onClick={onClick} title={label}>
      {label}
    </button>
  );
}
