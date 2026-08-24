import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { FormField } from '../../components/admin/FormField';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import {
  useAdminSellerRegistrations,
  useSellerRegistrationById,
} from '../../hooks/useAdminSellerRegistrations';
import { useToast } from '../../hooks/useToast';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';
import { sellerRegistrationBadgeClass } from '../../utils/adminBadge';
import {
  SELLER_REGISTRATION_MAX_ADMIN_NOTE,
  validateSellerRejectNote,
} from '../../utils/sellerRegistrationValidation';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function AdminSellerRegistrationDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const cached = useSellerRegistrationById(id);
  const { loadOne, approve, reject, mutating } = useAdminSellerRegistrations('Pending', {
    autoLoad: false,
  });

  const [item, setItem] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [adminNote, setAdminNote] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteTouched, setNoteTouched] = useState(false);
  const [rejectSubmitted, setRejectSubmitted] = useState(false);

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
          setLoadError(err instanceof Error ? err.message : 'Seller registration request not found.');
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
    () => tryValidateField(() => validateSellerRejectNote(adminNote)),
    [adminNote],
  );
  const visibleNoteError = visibleFieldErrors(
    { adminNote: noteError },
    { adminNote: noteTouched },
    rejectSubmitted,
  ).adminNote;

  const canReject =
    Boolean(item && item.status === 'Pending') &&
    noteDirty &&
    !noteError &&
    !mutating;

  const isPending = item?.status === 'Pending';

  async function confirmApprove() {
    if (!item || !isPending) return;

    setActionError(null);
    try {
      const result = await approve(item.requestId);
      setItem(result.request);
      setApproveOpen(false);
      toast.success('Seller registration approved.');
      navigate('/admin/seller-registrations');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to approve seller registration.';
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
      const updated = await reject(item.requestId, { adminNote: adminNote.trim() });
      setItem(updated);
      setRejectOpen(false);
      toast.success('Seller registration rejected.');
      navigate('/admin/seller-registrations');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reject seller registration.';
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
        {loadError || 'Seller registration request not found.'}{' '}
        <Link to="/admin/seller-registrations" className="alert-link">
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
              <h4 className="card-title mb-1">{item.shopName}</h4>
              <span className={sellerRegistrationBadgeClass(item.status)}>{item.status}</span>
            </div>
            <Link to="/admin/seller-registrations" className="btn btn-sm btn-light">
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
                <p className="text-muted mb-1">Applicant</p>
                <p className="mb-0 fw-medium">{item.userFullName}</p>
                <p className="text-muted mb-0">{item.userEmail}</p>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Submitted</p>
                <p className="mb-0">{formatDate(item.createdAt)}</p>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-1">Business information</p>
              <p className="mb-0">{item.businessInfo?.trim() || '—'}</p>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-2">Documents</p>
              {item.documentUrls.length === 0 ? (
                <p className="text-muted mb-0">No documents uploaded.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {item.documentUrls.map((url) => (
                    <li key={url} className="mb-1">
                      <a href={url} target="_blank" rel="noreferrer" className="link-primary">
                        <IconifyIcon icon="solar:document-bold-duotone" className="me-1 align-middle" />
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {item.status !== 'Pending' ? (
              <div className="border-top pt-3">
                <p className="text-muted mb-1">Review</p>
                <p className="mb-1">
                  By {item.reviewerFullName || 'Admin'} · {formatDate(item.reviewedAt)}
                </p>
                {item.adminNote ? <p className="mb-0">Note: {item.adminNote}</p> : null}
                {item.shopId ? (
                  <p className="text-muted mb-0 mt-1">
                    Shop id: <code>{item.shopId}</code>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="col-lg-4">
        <div className="card">
          <div className="card-header">
            <h4 className="card-title mb-0">Review decision</h4>
          </div>
          <div className="card-body">
            {!isPending ? (
              <p className="text-muted mb-0">This request has already been reviewed.</p>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-success w-100 mb-3"
                  disabled={mutating}
                  onClick={() => setApproveOpen(true)}
                >
                  Approve
                </button>

                <form onSubmit={handleRejectSubmit}>
                  <FormField
                    label="Rejection note"
                    htmlFor="adminNote"
                    error={visibleNoteError}
                  >
                    <textarea
                      id="adminNote"
                      className="form-control"
                      rows={4}
                      maxLength={SELLER_REGISTRATION_MAX_ADMIN_NOTE}
                      value={adminNote}
                      placeholder="Explain why this application is rejected..."
                      onChange={(e) => {
                        setAdminNote(e.target.value);
                        setNoteDirty(true);
                      }}
                      onBlur={() => {
                        if (noteDirty) setNoteTouched(true);
                      }}
                    />
                  </FormField>
                  <p className="text-muted fs-12 mb-3">
                    {adminNote.trim().length}/{SELLER_REGISTRATION_MAX_ADMIN_NOTE}
                  </p>
                  <button type="submit" className="btn btn-outline-danger w-100" disabled={!canReject}>
                    Reject
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <AdminConfirmModal
        open={approveOpen}
        title="Approve seller registration"
        confirmLabel="Approve"
        confirmVariant="success"
        confirming={mutating}
        onCancel={() => setApproveOpen(false)}
        onConfirm={() => void confirmApprove()}
      >
        <p className="mb-2">
          Approve <strong>{item.shopName}</strong>?
        </p>
        <p className="text-muted mb-0">
          This assigns the Seller role and creates a Shop and Wallet for{' '}
          <strong>{item.userFullName}</strong> ({item.userEmail}).
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={rejectOpen}
        title="Reject seller registration"
        confirmLabel="Reject"
        confirmVariant="danger"
        confirming={mutating}
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => void confirmReject()}
      >
        <p className="mb-2">
          Reject <strong>{item.shopName}</strong>?
        </p>
        <p className="text-muted mb-2">The applicant will not receive a shop. Your note:</p>
        <div className="bg-light-subtle border rounded p-2">
          <p className="mb-0">{adminNote.trim()}</p>
        </div>
      </AdminConfirmModal>
    </div>
  );
}
