import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { AdminRefundTransferPanel } from '../../components/admin/AdminRefundTransferPanel';
import { FormField } from '../../components/admin/FormField';
import { ReturnEvidencePanel } from '../../components/returns/ReturnEvidenceMedia';
import {
  useAdminReturnById,
  useAdminReturnRequests,
} from '../../hooks/useAdminReturnRequests';
import { useToast } from '../../hooks/useToast';
import { formatMoney } from '../../utils/formatCatalog';
import { parseUtcDate } from '../../utils/dateUtc';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';
import {
  formatReturnStatus,
  isLogisticsStatus,
  isTerminalReturnStatus,
  returnStatusBadgeClass,
} from '../../utils/returnUi';
import { addNotificationHandler, removeNotificationHandler } from '../../realtime/signalr';
import type { NotificationItem } from '../../types/notification';
import {
  nextReturnStatus,
  RETURN_MAX_ADMIN_NOTE,
  RETURN_MAX_STATUS_NOTE,
  validateReturnRejectNote,
  validateReturnStatusNote,
} from '../../utils/returnValidation';
import {
  adminMarkReturnReceiving,
  getAdminReturnShipment,
  retryAdminReturnPickup,
} from '../../services/returnApi';
import type { ReturnShipment } from '../../types/return';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = parseUtcDate(value);
  if (!date) return value;
  return date.toLocaleString();
}

export function AdminReturnRequestDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const cached = useAdminReturnById(id);
  const { loadOne, approve, reject, updateStatus, mutating } = useAdminReturnRequests('Pending', {
    autoLoad: false,
  });

  const [item, setItem] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const [adminNote, setAdminNote] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteTouched, setNoteTouched] = useState(false);
  const [rejectSubmitted, setRejectSubmitted] = useState(false);

  const [statusNote, setStatusNote] = useState('');
  const [statusTouched, setStatusTouched] = useState<{ note?: boolean }>({});
  const [statusSubmitted, setStatusSubmitted] = useState(false);

  const [shipment, setShipment] = useState<ReturnShipment | null>(null);
  const [retryOpen, setRetryOpen] = useState(false);
  const [markReceivingOpen, setMarkReceivingOpen] = useState(false);
  const [shipmentActing, setShipmentActing] = useState(false);
  const itemStatusRef = useRef(item?.status);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadOne(id)
      .then((data) => {
        if (!cancelled) { setItem(data); itemStatusRef.current = (data as typeof item)?.status ?? null; }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Return request not found.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadOne]);

  useEffect(() => {
    if (cached) { setItem(cached); itemStatusRef.current = cached?.status ?? null; }
  }, [cached]);

  // Silent reload for SignalR / poll — updates Redux (→ cached → item).
  const reloadSilent = useCallback(async () => {
    try { await loadOne(id); } catch { /* background refresh, don't surface */ }
  }, [id, loadOne]);

  // Real-time: listen on shared notification hub.
  useEffect(() => {
    if (!id) return;
    if (item && isTerminalReturnStatus(item.status)) return;

    const handler = (n: NotificationItem) => {
      if (n.referenceType === 'ReturnRequest' && n.referenceId?.toLowerCase() === id.toLowerCase()) {
        void reloadSilent();
      }
    };
    addNotificationHandler(handler);
    return () => removeNotificationHandler(handler);
  }, [id, reloadSilent, item?.status]);

  // Fallback poll every 60 s.
  useEffect(() => {
    if (!item || isTerminalReturnStatus(item.status)) return;
    const timer = setInterval(() => { void reloadSilent(); }, 60_000);
    return () => clearInterval(timer);
  }, [reloadSilent, item?.status]);

  const loadShipment = useCallback(async (returnId: string) => {
    const s = await getAdminReturnShipment(returnId);
    setShipment(s);
  }, []);

  useEffect(() => {
    if (!item) return;
    const shouldLoad =
      isLogisticsStatus(item.status) ||
      item.status === 'Receiving' ||
      item.status === 'Accepted' ||
      item.status === 'Refunded' ||
      item.status === 'Exchanged' ||
      item.status === 'Closed';
    if (shouldLoad) void loadShipment(item.returnRequestId);
  }, [item?.returnRequestId, item?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const noteError = useMemo(
    () => tryValidateField(() => validateReturnRejectNote(adminNote)),
    [adminNote],
  );
  const visibleNoteError = visibleFieldErrors(
    { adminNote: noteError },
    { adminNote: noteTouched },
    rejectSubmitted,
  ).adminNote;

  const statusNoteError = useMemo(
    () => tryValidateField(() => validateReturnStatusNote(statusNote)),
    [statusNote],
  );
  const visibleStatusNoteError = visibleFieldErrors(
    { note: statusNoteError },
    { note: statusTouched.note },
    statusSubmitted,
  ).note;

  const isPending = item?.status === 'Pending';
  const nextStatus = nextReturnStatus(item?.status, item?.resolutionType);
  const isReturnRefund = item?.resolutionType !== 'Exchange';
  const refundAmount = item
    ? (item.refundAmount ?? item.orderTotalAmount)
    : 0;
  const showRefundTransferPanel =
    Boolean(item) &&
    isReturnRefund &&
    (item!.status === 'Accepted' ||
      item!.status === 'Refunded' ||
      (item!.status === 'Closed' && item!.refundAmount != null));
  const refundCompleted =
    item?.status === 'Refunded' ||
    (item?.status === 'Closed' && item.refundAmount != null);

  const canReject =
    Boolean(item && isPending) && noteDirty && !noteError && !mutating;

  const canAdvanceStatus =
    Boolean(item && nextStatus) && !statusNoteError && !mutating;

  async function confirmApprove() {
    if (!item || !isPending) return;
    setActionError(null);
    try {
      const updated = await approve(item.returnRequestId);
      setItem(updated);
      setApproveOpen(false);
      toast.success('Return request approved.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to approve return request.';
      setActionError(message);
      toast.error(message);
    }
  }

  function handleRejectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item || !isPending) return;
    setRejectSubmitted(true);
    setNoteTouched(true);
    if (noteError) return;
    setRejectOpen(true);
  }

  async function confirmReject() {
    if (!item || !isPending || noteError) return;
    setActionError(null);
    try {
      const updated = await reject(item.returnRequestId, { adminNote: adminNote.trim() });
      setItem(updated);
      setRejectOpen(false);
      toast.success('Return request rejected.');
      navigate('/admin/return-requests');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reject return request.';
      setActionError(message);
      toast.error(message);
    }
  }

  function handleStatusSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item || !nextStatus) return;
    setStatusSubmitted(true);
    setStatusTouched({ note: true });
    if (statusNoteError) return;
    setStatusOpen(true);
  }

  async function confirmStatusUpdate() {
    if (!item || !nextStatus || statusNoteError) return;

    setActionError(null);
    try {
      const updated = await updateStatus(item.returnRequestId, {
        status: nextStatus,
        note: statusNote.trim() || null,
        ...(nextStatus === 'Refunded'
          ? {
              refundToBin: item.refundBankBin ?? null,
              refundToAccountNumber: item.refundAccountNumber ?? null,
            }
          : {}),
      });
      setItem(updated);
      setStatusOpen(false);
      setStatusNote('');
      setStatusTouched({});
      setStatusSubmitted(false);
      toast.success(
        nextStatus === 'Refunded'
          ? 'Refund marked as completed.'
          : `Return status updated to ${formatReturnStatus(nextStatus)}.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update return status.';
      setActionError(message);
      toast.error(message);
    }
  }

  async function confirmRetryPickup() {
    if (!item) return;
    setShipmentActing(true);
    try {
      const result = await retryAdminReturnPickup(item.returnRequestId);
      if (result.data) setShipment(result.data);
      setRetryOpen(false);
      toast.success('Retry pickup dispatched.');
      void loadShipment(item.returnRequestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to retry pickup.';
      setActionError(message);
      toast.error(message);
    } finally {
      setShipmentActing(false);
    }
  }

  async function confirmMarkReceiving() {
    if (!item) return;
    setShipmentActing(true);
    try {
      await adminMarkReturnReceiving(item.returnRequestId);
      setMarkReceivingOpen(false);
      toast.success('Return marked as receiving.');
      const updated = await loadOne(item.returnRequestId).catch(() => null);
      if (updated) setItem(updated);
      void loadShipment(item.returnRequestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to mark receiving.';
      setActionError(message);
      toast.error(message);
    } finally {
      setShipmentActing(false);
    }
  }

  if (loading && !item) {
    return <p className="text-muted">Loading...</p>;
  }

  if (loadError || !item) {
    return (
      <div className="alert alert-danger" role="alert">
        {loadError || 'Return request not found.'}{' '}
        <Link to="/admin/return-requests" className="alert-link">
          Back to list
        </Link>
      </div>
    );
  }

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
            <Link to="/admin/return-requests" className="btn btn-sm btn-light">
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
              <p className="mb-0 fw-medium">
                {item.resolutionType === 'Exchange' ? 'Exchange' : 'Return & refund'}
              </p>
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
                <p className="text-muted mb-1">Admin note</p>
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
                {item && !isTerminalReturnStatus(item.status) && (
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
        {shipment ? (
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Return shipment</h4>
              <span className={`badge ${shipment.status === 'PickupFailed' ? 'badge-soft-danger' : 'badge-soft-primary'}`}>
                {shipment.status}
              </span>
            </div>
            <div className="card-body">
              {shipment.trackingCode ? (
                <div className="mb-2">
                  <p className="text-muted mb-1">Tracking code</p>
                  <p className="mb-0 fw-medium">{shipment.trackingCode}</p>
                </div>
              ) : null}
              {shipment.shippingFeeQuoted != null ? (
                <div className="mb-2">
                  <p className="text-muted mb-1">Shipping fee (seller)</p>
                  <p className="mb-0">{formatMoney(shipment.shippingFeeQuoted, 'VND')}</p>
                </div>
              ) : null}
              {shipment.expectedDeliveryAt ? (
                <div className="mb-2">
                  <p className="text-muted mb-1">Expected delivery</p>
                  <p className="mb-0">{formatDate(shipment.expectedDeliveryAt)}</p>
                </div>
              ) : null}
              {shipment.attemptCount > 1 ? (
                <p className="text-muted mb-2 fs-12">Attempt {shipment.attemptCount}</p>
              ) : null}
              {shipment.lastError ? (
                <div className="alert alert-warning py-1 px-2 mb-2 fs-12" role="alert">
                  {shipment.lastError}
                </div>
              ) : null}
              <div className="d-flex gap-2 flex-column">
                {item.status === 'PickupFailed' ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-100"
                    disabled={shipmentActing}
                    onClick={() => setRetryOpen(true)}
                  >
                    Retry pickup
                  </button>
                ) : null}
                {(isLogisticsStatus(item.status) || item.status === 'PickupFailed') ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm w-100"
                    disabled={shipmentActing}
                    onClick={() => setMarkReceivingOpen(true)}
                  >
                    Mark as received (override)
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {isPending ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Review</h4>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Approve to forward this request to the seller. After the seller accepts the returned
                goods, complete Refunded/Exchanged → Closed here. Reject requires an admin note.
              </p>
              <button
                type="button"
                className="btn btn-primary w-100 mb-2"
                disabled={mutating}
                onClick={() => setApproveOpen(true)}
              >
                Approve & forward to seller
              </button>

              <form onSubmit={handleRejectSubmit}>
                <FormField
                  htmlFor="return-admin-note"
                  label="Reject note"
                  error={visibleNoteError}
                >
                  <textarea
                    id="return-admin-note"
                    className="form-control"
                    rows={4}
                    maxLength={RETURN_MAX_ADMIN_NOTE}
                    value={adminNote}
                    onBlur={() => setNoteTouched(true)}
                    onChange={(e) => {
                      setAdminNote(e.target.value);
                      setNoteDirty(true);
                    }}
                    placeholder="Explain why this return is rejected"
                  />
                </FormField>
                <button
                  type="submit"
                  className="btn btn-outline-danger w-100"
                  disabled={!canReject}
                >
                  Reject return
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {item.status === 'Approved' ||
        item.status === 'SellerConfirmed' ||
        item.status === 'Receiving' ? (
          <div className="card">
            <div className="card-body">
              <p className="text-muted mb-0">
                Waiting on the seller pipeline ({formatReturnStatus(item.status)}). You can complete
                refund or exchange after the seller accepts the returned goods.
              </p>
            </div>
          </div>
        ) : null}

        {showRefundTransferPanel ? (
          <AdminRefundTransferPanel
            refunded={Boolean(refundCompleted)}
            orderCode={item.orderCode}
            amount={refundAmount}
            bankBin={item.refundBankBin}
            bankName={item.refundBankName}
            accountNumber={item.refundAccountNumber}
            accountName={item.refundAccountName}
          />
        ) : null}

        {nextStatus ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Advance status</h4>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Next step: <strong>{formatReturnStatus(nextStatus)}</strong>
              </p>
              {nextStatus === 'Refunded' ? (
                <p className="text-muted fs-12">
                  Transfer via the QR above (or the account details), then confirm below.
                </p>
              ) : null}

              <form onSubmit={handleStatusSubmit}>
                <FormField
                  htmlFor="return-status-note"
                  label="Note (optional)"
                  error={visibleStatusNoteError}
                >
                  <textarea
                    id="return-status-note"
                    className="form-control"
                    rows={3}
                    maxLength={RETURN_MAX_STATUS_NOTE}
                    value={statusNote}
                    onBlur={() => setStatusTouched((prev) => ({ ...prev, note: true }))}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                </FormField>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={!canAdvanceStatus}
                >
                  {nextStatus === 'Refunded'
                    ? 'Confirm refunded'
                    : `Move to ${formatReturnStatus(nextStatus)}`}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {item.status === 'Rejected' || item.status === 'Closed' ? (
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
        open={approveOpen}
        title="Forward return to seller"
        confirmLabel="Forward"
        confirmVariant="success"
        confirming={mutating}
        onCancel={() => setApproveOpen(false)}
        onConfirm={() => void confirmApprove()}
      >
        <p className="mb-0">
          Forward return for order <strong>{item.orderCode}</strong> to the seller? The seller must
          confirm handling, receive the goods, and accept them before you can complete refund or
          exchange.
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={rejectOpen}
        title="Reject return request"
        confirmLabel="Reject"
        confirmVariant="danger"
        confirming={mutating}
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => void confirmReject()}
      >
        <p className="mb-2">Reject this return request? The buyer will see your admin note.</p>
        <p className="text-muted mb-0">{adminNote.trim()}</p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={statusOpen}
        title={`Update to ${formatReturnStatus(nextStatus ?? '')}`}
        confirmLabel="Update status"
        confirming={mutating}
        onCancel={() => setStatusOpen(false)}
        onConfirm={() => void confirmStatusUpdate()}
      >
        <p className="mb-0">
          {nextStatus === 'Refunded'
            ? 'Confirm you have transferred the refund to the buyer\'s bank account and mark this request as Refunded.'
            : `Confirm moving this return request to ${formatReturnStatus(nextStatus ?? '')}?`}
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={retryOpen}
        title="Retry return pickup"
        confirmLabel="Retry"
        confirmVariant="success"
        confirming={shipmentActing}
        onCancel={() => setRetryOpen(false)}
        onConfirm={() => void confirmRetryPickup()}
      >
        <p className="mb-0">
          Dispatch a new GHN pickup request for order <strong>{item.orderCode}</strong>? The seller
          will be charged the shipping fee again if the previous charge was not applied.
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={markReceivingOpen}
        title="Mark return as received"
        confirmLabel="Mark received"
        confirming={shipmentActing}
        onCancel={() => setMarkReceivingOpen(false)}
        onConfirm={() => void confirmMarkReceiving()}
      >
        <p className="mb-0">
          Manually mark this return as received by the seller, bypassing the carrier webhook? Use
          this when the item arrived but the shipment tracking did not update.
        </p>
      </AdminConfirmModal>
    </div>
  );
}
