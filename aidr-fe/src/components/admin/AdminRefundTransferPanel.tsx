import { useMemo, useState } from 'react';
import { IconifyIcon } from './IconifyIcon';
import { formatMoney } from '../../utils/formatCatalog';
import { buildRefundTransferNote, buildVietQrImageUrl } from '../../utils/vietQr';

export type AdminRefundTransferPanelProps = {
  /** When true, show success state instead of QR. */
  refunded: boolean;
  orderCode: string;
  amount: number;
  bankBin?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  /** Screenshot of the bank transfer (shown after refunded). */
  proofUrl?: string | null;
};

/**
 * Admin helper: VietQR to transfer a refund to the buyer's bank, or a success
 * banner after the return has been marked Refunded / Closed.
 */
export function AdminRefundTransferPanel({
  refunded,
  orderCode,
  amount,
  bankBin,
  bankName,
  accountNumber,
  accountName,
  proofUrl,
}: AdminRefundTransferPanelProps) {
  const [qrFailed, setQrFailed] = useState(false);

  const addInfo = useMemo(() => buildRefundTransferNote(orderCode), [orderCode]);
  const qrUrl = useMemo(() => {
    if (!bankBin || !accountNumber) return null;
    return buildVietQrImageUrl({
      bankId: bankBin,
      accountNumber,
      accountName,
      amount,
      addInfo,
      template: 'compact2',
    });
  }, [bankBin, accountNumber, accountName, amount, addInfo]);

  if (refunded) {
    return (
      <div className="card border-success">
        <div className="card-body">
          <div className="d-flex align-items-start gap-2">
            <IconifyIcon icon="solar:check-circle-bold" className="text-success fs-24" />
            <div className="flex-grow-1">
              <h5 className="mb-1 text-success">Refund completed</h5>
              <p className="mb-1">
                {formatMoney(amount, 'VND')} was marked as refunded to the buyer
                {accountNumber ? (
                  <>
                    {' '}
                    (<span className="fw-medium">{accountNumber}</span>
                    {accountName ? ` · ${accountName}` : ''})
                  </>
                ) : null}
                .
              </p>
              {proofUrl ? (
                <div className="mt-3">
                  <p className="text-muted mb-2 fs-12">Transfer proof sent to the buyer</p>
                  <a href={proofUrl} target="_blank" rel="noreferrer">
                    <img
                      src={proofUrl}
                      alt={`Refund transfer proof for order ${orderCode}`}
                      className="img-fluid rounded border"
                      style={{ maxWidth: 320 }}
                    />
                  </a>
                </div>
              ) : null}
              <p className="text-muted mb-0 fs-12 mt-2">
                You can close this request when no further follow-up is needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasAccount = Boolean(accountNumber?.trim());

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Refund transfer</h4>
      </div>
      <div className="card-body">
        <p className="text-muted mb-3">
          Scan the QR with your banking app to refund the buyer, upload a screenshot of the
          transfer, then mark the request as <strong>Refunded</strong>.
        </p>

        <div className="mb-3">
          <p className="text-muted mb-1">Amount</p>
          <p className="mb-0 fw-semibold fs-18">{formatMoney(amount, 'VND')}</p>
        </div>

        {!hasAccount ? (
          <div className="alert alert-warning mb-0" role="alert">
            Buyer did not provide a bank account. Confirm the refund destination before
            proceeding.
          </div>
        ) : (
          <>
            {qrUrl && !qrFailed ? (
              <div className="text-center mb-3">
                <img
                  src={qrUrl}
                  alt={`VietQR refund for order ${orderCode}`}
                  className="img-fluid rounded border"
                  style={{ maxWidth: 280 }}
                  onError={() => setQrFailed(true)}
                />
                <p className="text-muted fs-12 mt-2 mb-0">Scan with a Napas 24/7 banking app</p>
              </div>
            ) : (
              <div className="alert alert-info mb-3" role="alert">
                {qrFailed || !bankBin
                  ? 'QR could not be generated. Transfer manually using the account below.'
                  : 'Transfer manually using the account below.'}
              </div>
            )}

            <dl className="row mb-2 fs-14">
              <dt className="col-5 text-muted">Bank</dt>
              <dd className="col-7 mb-2">
                {bankName?.trim() || '—'}
                {bankBin ? (
                  <span className="text-muted"> (BIN {bankBin})</span>
                ) : null}
              </dd>
              <dt className="col-5 text-muted">Account number</dt>
              <dd className="col-7 mb-2 fw-medium">{accountNumber}</dd>
              <dt className="col-5 text-muted">Account name</dt>
              <dd className="col-7 mb-2">{accountName?.trim() || '—'}</dd>
              <dt className="col-5 text-muted">Transfer note</dt>
              <dd className="col-7 mb-0">
                <code className="fs-12">{addInfo}</code>
              </dd>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
