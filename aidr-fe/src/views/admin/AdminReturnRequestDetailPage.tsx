import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { FormField } from '../../components/admin/FormField';
import { ReturnEvidencePanel } from '../../components/returns/ReturnEvidenceMedia';
import {
  useAdminReturnById,
  useAdminReturnRequests,
} from '../../hooks/useAdminReturnRequests';
import { useToast } from '../../hooks/useToast';
import { formatMoney } from '../../utils/formatCatalog';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';
import { formatReturnStatus, returnStatusBadgeClass } from '../../utils/returnUi';
import {
  nextReturnStatus,
  RETURN_MAX_ADMIN_NOTE,
  RETURN_MAX_BANK_ACCOUNT,
  RETURN_MAX_BANK_BIN,
  RETURN_MAX_STATUS_NOTE,
  validateOptionalBankAccount,
  validateOptionalBankBin,
  validateReturnRejectNote,
  validateReturnStatusNote,
} from '../../utils/returnValidation';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
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
  const [refundToBin, setRefundToBin] = useState('');
  const [refundToAccountNumber, setRefundToAccountNumber] = useState('');
  const [statusTouched, setStatusTouched] = useState<{
    note?: boolean;
    refundToBin?: boolean;
    refundToAccountNumber?: boolean;
  }>({});
  const [statusSubmitted, setStatusSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadOne(id)
      .then((data) => {
        if (!cancelled) setItem(data);
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
    if (cached) setItem(cached);
  }, [cached]);

  const noteError = useMemo(
    () => tryValidateField(() => validateReturnRejectNote(adminNote)),
    [adminNote],
  );
  const visibleNoteError = visibleFieldErrors(
    { adminNote: noteError },
    { adminNote: noteTouched },
    rejectSubmitted,
  ).adminNote;

  const statusFieldErrors = useMemo(
    () => ({
      note: tryValidateField(() => {
        validateReturnStatusNote(statusNote);
      }),
      refundToBin: tryValidateField(() => {
        validateOptionalBankBin(refundToBin);
      }),
      refundToAccountNumber: tryValidateField(() => {
        validateOptionalBankAccount(refundToAccountNumber);
      }),
    }),
    [refundToAccountNumber, refundToBin, statusNote],
  );
  const visibleStatusErrors = visibleFieldErrors(
    statusFieldErrors,
    statusTouched,
    statusSubmitted,
  );

  const isPending = item?.status === 'Pending';
  const nextStatus = nextReturnStatus(item?.status, item?.resolutionType);
  const needsRefundBank =
    nextStatus === 'Refunded' &&
    (!refundToBin.trim() || !refundToAccountNumber.trim());

  const canReject =
    Boolean(item && isPending) && noteDirty && !noteError && !mutating;

  const canAdvanceStatus =
    Boolean(item && nextStatus) &&
    !statusFieldErrors.note &&
    !statusFieldErrors.refundToBin &&
    !statusFieldErrors.refundToAccountNumber &&
    !mutating;

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
    setStatusTouched({ note: true, refundToBin: true, refundToAccountNumber: true });
    if (
      statusFieldErrors.note ||
      statusFieldErrors.refundToBin ||
      statusFieldErrors.refundToAccountNumber
    ) {
      return;
    }
    setStatusOpen(true);
  }

  async function confirmStatusUpdate() {
    if (!item || !nextStatus) return;
    if (
      statusFieldErrors.note ||
      statusFieldErrors.refundToBin ||
      statusFieldErrors.refundToAccountNumber
    ) {
      return;
    }

    setActionError(null);
    try {
      const updated = await updateStatus(item.returnRequestId, {
        status: nextStatus,
        note: statusNote.trim() || null,
        refundToBin: refundToBin.trim() || null,
        refundToAccountNumber: refundToAccountNumber.trim() || null,
      });
      setItem(updated);
      setStatusOpen(false);
      setStatusNote('');
      setRefundToBin('');
      setRefundToAccountNumber('');
      setStatusTouched({});
      setStatusSubmitted(false);
      toast.success(`Return status updated to ${formatReturnStatus(nextStatus)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update return status.';
      setActionError(message);
      toast.error(message);
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
              <p className="text-muted mb-2">Status history</p>
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
                <div className="alert alert-info" role="alert">
                  Refund calls payOS payout. Provide buyer bank BIN and account if the payment
                  webhook did not store the counter account.
                </div>
              ) : null}

              <form onSubmit={handleStatusSubmit}>
                <FormField
                  htmlFor="return-status-note"
                  label="Note (optional)"
                  error={visibleStatusErrors.note}
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

                {nextStatus === 'Refunded' ? (
                  <>
                    <FormField
                      htmlFor="return-refund-bin"
                      label="Refund bank BIN"
                      error={visibleStatusErrors.refundToBin}
                    >
                      <input
                        id="return-refund-bin"
                        className="form-control"
                        maxLength={RETURN_MAX_BANK_BIN}
                        value={refundToBin}
                        onBlur={() =>
                          setStatusTouched((prev) => ({ ...prev, refundToBin: true }))
                        }
                        onChange={(e) => setRefundToBin(e.target.value)}
                        placeholder="e.g. 970422"
                      />
                    </FormField>
                    <FormField
                      htmlFor="return-refund-account"
                      label="Refund account number"
                      error={visibleStatusErrors.refundToAccountNumber}
                    >
                      <input
                        id="return-refund-account"
                        className="form-control"
                        maxLength={RETURN_MAX_BANK_ACCOUNT}
                        value={refundToAccountNumber}
                        onBlur={() =>
                          setStatusTouched((prev) => ({
                            ...prev,
                            refundToAccountNumber: true,
                          }))
                        }
                        onChange={(e) => setRefundToAccountNumber(e.target.value)}
                        placeholder="Buyer bank account"
                      />
                    </FormField>
                    {needsRefundBank ? (
                      <p className="text-muted fs-12">
                        Optional if webhook already stored counter account; required when payOS
                        payout cannot resolve the destination.
                      </p>
                    ) : null}
                  </>
                ) : null}

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={!canAdvanceStatus}
                >
                  Move to {formatReturnStatus(nextStatus)}
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
            ? 'This will refund the buyer via payOS payout and debit the seller wallet.'
            : `Confirm moving this return request to ${formatReturnStatus(nextStatus ?? '')}?`}
        </p>
      </AdminConfirmModal>
    </div>
  );
}
