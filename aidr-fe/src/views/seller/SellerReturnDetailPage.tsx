import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { FormField } from '../../components/admin/FormField';
import { ReturnEvidencePanel } from '../../components/returns/ReturnEvidenceMedia';
import { useSellerReturnDetail } from '../../hooks/useSellerReturns';
import { useToast } from '../../hooks/useToast';
import { addNotificationHandler, removeNotificationHandler } from '../../realtime/signalr';
import type { NotificationItem } from '../../types/notification';
import { formatMoney } from '../../utils/formatCatalog';
import { parseUtcDate } from '../../utils/dateUtc';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';
import {
  formatResolutionType,
  formatReturnStatus,
  isLogisticsStatus,
  isTerminalReturnStatus,
  returnStatusBadgeClass,
} from '../../utils/returnUi';
import { RETURN_MAX_ADMIN_NOTE, RETURN_MAX_STATUS_NOTE } from '../../utils/returnValidation';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = parseUtcDate(value);
  if (!date) return value;
  return date.toLocaleString();
}

export function SellerReturnDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { item, loading, mutating, error, reload, confirm, markReceiving, acceptGoods, reject } =
    useSellerReturnDetail(id);

  // Real-time: receive push from the shared notification hub when this return changes.
  useEffect(() => {
    if (!id) return;
    if (item && isTerminalReturnStatus(item.status)) return;

    const handler = (n: NotificationItem) => {
      if (n.referenceType === 'ReturnRequest' && n.referenceId?.toLowerCase() === id.toLowerCase()) {
        void reload();
      }
    };
    addNotificationHandler(handler);
    return () => removeNotificationHandler(handler);
  }, [id, reload, item?.status]);

  // Fallback poll every 60 s (catches SignalR reconnect gaps).
  useEffect(() => {
    if (!item || isTerminalReturnStatus(item.status)) return;
    const timer = setInterval(() => { void reload(); }, 60_000);
    return () => clearInterval(timer);
  }, [reload, item?.status]);

  const [resolutionType, setResolutionType] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectDirty, setRejectDirty] = useState(false);
  const [rejectTouched, setRejectTouched] = useState(false);
  const [rejectSubmitted, setRejectSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receivingOpen, setReceivingOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const rejectError = useMemo(
    () =>
      tryValidateField(() => {
        const trimmed = rejectNote.trim();
        if (!trimmed) throw new Error('Note is required when rejecting a return request.');
        if (trimmed.length > RETURN_MAX_ADMIN_NOTE) {
          throw new Error(`Note must not exceed ${RETURN_MAX_ADMIN_NOTE} characters.`);
        }
      }),
    [rejectNote],
  );
  const visibleRejectError = visibleFieldErrors(
    { note: rejectError },
    { note: rejectTouched },
    rejectSubmitted,
  ).note;

  const noteLengthError = useMemo(
    () =>
      tryValidateField(() => {
        if (!actionNote.trim()) return;
        if (actionNote.trim().length > RETURN_MAX_STATUS_NOTE) {
          throw new Error(`Note must not exceed ${RETURN_MAX_STATUS_NOTE} characters.`);
        }
      }),
    [actionNote],
  );

  if (loading && !item) {
    return <p className="text-muted">Loading...</p>;
  }

  if (error || !item) {
    return (
      <div className="alert alert-danger" role="alert">
        {error || 'Return request not found.'}{' '}
        <Link to="/seller/returns" className="alert-link">
          Back to list
        </Link>
      </div>
    );
  }

  const canConfirm = item.status === 'Approved' && !mutating && !noteLengthError;
  const canReceiving =
    (item.status === 'SellerConfirmed' || isLogisticsStatus(item.status)) &&
    !mutating &&
    !noteLengthError;
  const canAccept = item.status === 'Receiving' && !mutating && !noteLengthError;
  const canReject =
    (item.status === 'Approved' || item.status === 'Receiving') &&
    rejectDirty &&
    !rejectError &&
    !mutating;

  async function onConfirm() {
    if (!item) return;
    setActionError(null);
    try {
      await confirm({
        resolutionType: (resolutionType || item.resolutionType) as 'ReturnRefund' | 'Exchange',
        note: actionNote.trim() || null,
      });
      setConfirmOpen(false);
      toast.success('Handling plan confirmed. Buyer was notified to ship the item back.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to confirm return.';
      setActionError(message);
      toast.error(message);
    }
  }

  async function onReceiving() {
    setActionError(null);
    try {
      await markReceiving({ note: actionNote.trim() || null });
      setReceivingOpen(false);
      toast.success('Marked as receiving.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to mark receiving.';
      setActionError(message);
      toast.error(message);
    }
  }

  async function onAccept() {
    setActionError(null);
    try {
      await acceptGoods({ note: actionNote.trim() || null });
      setAcceptOpen(false);
      toast.success('Goods accepted. Admin was notified to complete refund or exchange.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to accept goods.';
      setActionError(message);
      toast.error(message);
    }
  }

  function handleRejectSubmit(e: FormEvent) {
    e.preventDefault();
    setRejectSubmitted(true);
    setRejectTouched(true);
    if (rejectError) return;
    setRejectOpen(true);
  }

  async function onReject() {
    if (rejectError) return;
    setActionError(null);
    try {
      await reject({ note: rejectNote.trim() });
      setRejectOpen(false);
      toast.success('Return request rejected.');
      navigate('/seller/returns');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reject return.';
      setActionError(message);
      toast.error(message);
    }
  }

  // Extract tracking code from status history notes
  const trackingCode = (() => {
    for (const h of [...item.statusHistories].reverse()) {
      if (h.toStatus === 'AwaitingPickup' && h.note?.startsWith('Return shipment created:')) {
        return h.note.split(':').slice(1).join(':').trim();
      }
    }
    return null;
  })();

  const showShipmentInfo = isLogisticsStatus(item.status) || !!trackingCode;

  return (
    <div className="row">
      <div className="col-lg-8">
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div>
              <h4 className="card-title mb-1">{item.orderCode}</h4>
              <span className={returnStatusBadgeClass(item.status)}>
                {formatReturnStatus(item.status)}
              </span>
            </div>
            <Link to="/seller/returns" className="btn btn-sm btn-light">
              Back to list
            </Link>
          </div>
          <div className="card-body">
            {actionError ? (
              <div className="alert alert-danger" role="alert">
                {actionError}
              </div>
            ) : null}

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <p className="text-muted mb-1">Buyer</p>
                <p className="mb-0 fw-medium">{item.buyerFullName}</p>
                <p className="text-muted mb-0">{item.buyerEmail}</p>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Shop</p>
                <p className="mb-0 fw-medium">{item.shopName}</p>
                <p className="text-muted mb-0">Order status: {item.orderStatus}</p>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Submitted</p>
                <p className="mb-0">{formatDate(item.createdAt)}</p>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Order total</p>
                <p className="mb-0 fw-medium">{formatMoney(item.orderTotalAmount, 'VND')}</p>
                {item.refundAmount != null ? (
                  <p className="text-muted mb-0">
                    Refund: {formatMoney(item.refundAmount, 'VND')}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-1">Resolution</p>
              <p className="mb-0 fw-medium">{formatResolutionType(item.resolutionType)}</p>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-1">Reason</p>
              <p className="mb-0">{item.reason}</p>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-1">Description</p>
              <p className={`mb-0${!item.description?.trim() ? ' text-muted' : ''}`}>
                {item.description?.trim() || 'No description provided'}
              </p>
            </div>

            {item.adminNote ? (
              <div className="mb-3">
                <p className="text-muted mb-1">Decision note</p>
                <p className="mb-0">{item.adminNote}</p>
              </div>
            ) : null}

            <div className="mb-3">
              <p className="text-muted mb-2">Returned items</p>
              <div className="table-responsive">
                <table className="table table-sm table-centered mb-0">
                  <thead className="bg-light-subtle">
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.items.map((line) => (
                      <tr key={line.returnItemId}>
                        <td>
                          {line.productName}
                          {line.sku ? (
                            <div className="text-muted fs-12">SKU: {line.sku}</div>
                          ) : null}
                        </td>
                        <td>{line.quantity}</td>
                        <td>{formatMoney(line.unitPrice, 'VND')}</td>
                        <td>{formatMoney(line.lineTotal, 'VND')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-2">Evidence videos</p>
              <ReturnEvidencePanel evidences={item.evidences} />
            </div>

            <div className="mb-0">
              <p className="text-muted mb-2 d-flex align-items-center gap-2">
                Status history
                {!isTerminalReturnStatus(item.status) && (
                  <span className="badge bg-success-subtle text-success fw-normal" style={{ fontSize: '0.7rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: 'currentColor',
                        marginRight: 4,
                        animation: 'return-live-pulse 2s ease-in-out infinite',
                      }}
                      aria-hidden
                    />
                    Live
                  </span>
                )}
              </p>
              {item.statusHistories.length === 0 ? (
                <p className="text-muted mb-0">No history yet.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {item.statusHistories.map((entry, index) => (
                    <li
                      key={`${entry.toStatus}-${entry.createdAt}-${index}`}
                      className="mb-2 pb-2 border-bottom border-light"
                    >
                      <div className="d-flex justify-content-between gap-2 flex-wrap">
                        <span className={returnStatusBadgeClass(entry.toStatus)}>
                          {formatReturnStatus(entry.toStatus)}
                        </span>
                        <span className="text-muted fs-12">{formatDate(entry.createdAt)}</span>
                      </div>
                      {entry.changedByFullName ? (
                        <p className="mb-0 fs-12 text-muted">By {entry.changedByFullName}</p>
                      ) : null}
                      {entry.note ? <p className="mb-0 mt-1">{entry.note}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-4">
        {showShipmentInfo ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Return pickup in progress</h4>
            </div>
            <div className="card-body">
              <p className="text-muted">
                A shipper is picking up the item from the buyer and delivering it to your shop.
              </p>
              {trackingCode ? (
                <div className="mb-2">
                  <p className="text-muted mb-1">Tracking code</p>
                  <p className="mb-0 fw-medium">{trackingCode}</p>
                </div>
              ) : null}
              {item.status === 'PickupFailed' ? (
                <div className="alert alert-warning py-2 px-3 mb-0 fs-12" role="alert">
                  Pickup failed. AIDR support will arrange another attempt or contact you.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {item.status === 'Approved' ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Confirm handling</h4>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Confirm the resolution plan. The buyer will be asked to ship the item back.
              </p>
              <FormField label="Resolution" htmlFor="seller-resolution">
                <AdminSelect
                  id="seller-resolution"
                  value={resolutionType || item.resolutionType}
                  options={[
                    { value: 'ReturnRefund', label: 'Return & refund' },
                    { value: 'Exchange', label: 'Exchange' },
                  ]}
                  onChange={setResolutionType}
                />
              </FormField>
              <FormField
                label="Note (optional)"
                htmlFor="seller-confirm-note"
                error={noteLengthError ?? undefined}
              >
                <textarea
                  id="seller-confirm-note"
                  className="form-control"
                  rows={3}
                  maxLength={RETURN_MAX_STATUS_NOTE}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Optional note for the buyer"
                />
              </FormField>
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!canConfirm}
                onClick={() => setConfirmOpen(true)}
              >
                Confirm plan
              </button>
            </div>
          </div>
        ) : null}

        {(item.status === 'SellerConfirmed' || isLogisticsStatus(item.status)) ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Receive goods</h4>
            </div>
            <div className="card-body">
              <p className="text-muted">
                {isLogisticsStatus(item.status)
                  ? 'If the package arrived at your shop but tracking hasn\'t updated, mark it manually.'
                  : 'Mark when the buyer\'s package arrives and inspection starts.'}
              </p>
              <FormField
                label="Note (optional)"
                htmlFor="seller-receiving-note"
                error={noteLengthError ?? undefined}
              >
                <textarea
                  id="seller-receiving-note"
                  className="form-control"
                  rows={3}
                  maxLength={RETURN_MAX_STATUS_NOTE}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              </FormField>
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!canReceiving}
                onClick={() => setReceivingOpen(true)}
              >
                Mark receiving
              </button>
            </div>
          </div>
        ) : null}

        {item.status === 'Receiving' ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Inspect & accept</h4>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Accept only if the returned item matches the claim. Admin will be notified.
              </p>
              <FormField
                label="Note (optional)"
                htmlFor="seller-accept-note"
                error={noteLengthError ?? undefined}
              >
                <textarea
                  id="seller-accept-note"
                  className="form-control"
                  rows={3}
                  maxLength={RETURN_MAX_STATUS_NOTE}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              </FormField>
              <button
                type="button"
                className="btn btn-primary w-100 mb-2"
                disabled={!canAccept}
                onClick={() => setAcceptOpen(true)}
              >
                Accept goods
              </button>
            </div>
          </div>
        ) : null}

        {(item.status === 'Approved' || item.status === 'Receiving') ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Reject</h4>
            </div>
            <div className="card-body">
              <form onSubmit={handleRejectSubmit}>
                <FormField
                  label="Reject note"
                  htmlFor="seller-reject-note"
                  error={visibleRejectError}
                >
                  <textarea
                    id="seller-reject-note"
                    className="form-control"
                    rows={4}
                    maxLength={RETURN_MAX_ADMIN_NOTE}
                    value={rejectNote}
                    onChange={(e) => {
                      setRejectNote(e.target.value);
                      setRejectDirty(true);
                    }}
                    onBlur={() => setRejectTouched(true)}
                    placeholder="Explain why this return is rejected"
                  />
                </FormField>
                <button type="submit" className="btn btn-outline-danger w-100" disabled={!canReject}>
                  Reject return
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {item.status === 'Accepted' ||
        item.status === 'Refunded' ||
        item.status === 'Exchanged' ||
        item.status === 'Closed' ||
        item.status === 'Rejected' ? (
          <div className="card">
            <div className="card-body">
              <p className="text-muted mb-0">
                This return request is {formatReturnStatus(item.status).toLowerCase()}. No further
                actions are available.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <AdminConfirmModal
        open={confirmOpen}
        title="Confirm handling plan"
        confirmLabel="Confirm"
        confirmVariant="success"
        confirming={mutating}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirm()}
      >
        <p className="mb-0">
          Confirm {formatResolutionType(resolutionType || item.resolutionType)} for order{' '}
          <strong>{item.orderCode}</strong>? The buyer will be asked to ship the item back.
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={receivingOpen}
        title="Mark receiving"
        confirmLabel="Mark receiving"
        confirming={mutating}
        onCancel={() => setReceivingOpen(false)}
        onConfirm={() => void onReceiving()}
      >
        <p className="mb-0">Confirm that the returned package for this order has arrived?</p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={acceptOpen}
        title="Accept returned goods"
        confirmLabel="Accept"
        confirmVariant="success"
        confirming={mutating}
        onCancel={() => setAcceptOpen(false)}
        onConfirm={() => void onAccept()}
      >
        <p className="mb-0">
          Accept the returned goods after inspection? Admin will be notified to complete the
          request.
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={rejectOpen}
        title="Reject return request"
        confirmLabel="Reject"
        confirmVariant="danger"
        confirming={mutating}
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => void onReject()}
      >
        <p className="mb-0">Reject this return request? The buyer will see your note.</p>
      </AdminConfirmModal>
    </div>
  );
}
