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

function statusLabel(status: string) {
  return status === 'NeedsMoreInfo' ? 'waiting on the applicant' : status.toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function AdminSellerRegistrationDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const cached = useSellerRegistrationById(id);
  const { loadOne, approve, reject, requestMoreInfo, mutating } = useAdminSellerRegistrations(
    'Pending',
    { autoLoad: false },
  );

  const [item, setItem] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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

  // Both "send back" actions write the same note, so they share one validation.
  const canSendBack =
    Boolean(item && item.status === 'Pending') && noteDirty && !noteError && !mutating;

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

  function openSendBack(which: 'reject' | 'info') {
    if (!item || !isPending) return;
    setRejectSubmitted(true);
    setNoteTouched(true);
    if (noteError || !noteDirty) return;
    if (which === 'reject') setRejectOpen(true);
    else setInfoOpen(true);
  }

  function handleRejectSubmit(e: FormEvent) {
    e.preventDefault();
    openSendBack('reject');
  }

  async function confirmRequestInfo() {
    if (!item || !isPending || noteError) return;

    setActionError(null);
    try {
      const updated = await requestMoreInfo(item.requestId, { adminNote: adminNote.trim() });
      setItem(updated);
      setInfoOpen(false);
      toast.success('Sent back to the applicant for more information.');
      navigate('/admin/seller-registrations');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send this application back.';
      setActionError(message);
      toast.error(message);
    }
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
            {item.duplicateIdentityWarning?.hasDuplicate ? (
              <div className="alert alert-warning d-flex gap-2 align-items-start mb-3" role="alert">
                <IconifyIcon icon="solar:danger-triangle-bold" className="fs-20 flex-shrink-0 mt-1" />
                <div>
                  <p className="fw-semibold mb-1">Duplicate identity warning</p>
                  <p className="mb-1">{item.duplicateIdentityWarning.message}</p>
                  {item.duplicateIdentityWarning.matchedUserEmail ||
                  item.duplicateIdentityWarning.matchedShopName ? (
                    <p className="mb-0 fs-13 text-muted">
                      Matches{' '}
                      {item.duplicateIdentityWarning.matchedUserEmail
                        ? item.duplicateIdentityWarning.matchedUserEmail
                        : 'another account'}
                      {item.duplicateIdentityWarning.matchedShopName
                        ? ` · Shop: ${item.duplicateIdentityWarning.matchedShopName}`
                        : ''}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

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

            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <p className="text-muted mb-1">Business type</p>
                <p className="mb-0">{item.businessType || 'Individual'}</p>
              </div>
              <div className="col-sm-6">
                <p className="text-muted mb-1">Tax code</p>
                <p className={`mb-0${item.taxCode ? '' : ' text-muted'}`}>
                  {item.taxCode || 'Not applicable'}
                </p>
              </div>
              <div className="col-sm-6">
                <p className="text-muted mb-1">Contact</p>
                <p
                  className={`mb-0${item.contactPhone || item.contactEmail ? '' : ' text-muted'}`}
                >
                  {[item.contactPhone, item.contactEmail].filter(Boolean).join(' · ') ||
                    'Not provided'}
                </p>
              </div>
              <div className="col-sm-6">
                <p className="text-muted mb-1">Business address</p>
                <p className={`mb-0${item.businessAddress ? '' : ' text-muted'}`}>
                  {item.businessAddress || 'Not provided'}
                </p>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-1">Business information</p>
              <p className={`mb-0${!item.businessInfo?.trim() ? ' text-muted' : ''}`}>
                {item.businessInfo?.trim() || 'No business information provided'}
              </p>
            </div>

            {/*
              Identity check, shown next to the paperwork so the reviewer can see
              at a glance whether the applicant is who they claim to be.
            */}
            {item.kyc ? (
              <div className="border rounded p-3 mb-3">
                <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
                  <p className="mb-0 fw-semibold">Identity verification (eKYC)</p>
                  <span
                    className={
                      item.kyc.status === 'Passed'
                        ? 'badge bg-success text-light px-2 py-1 fs-13'
                        : item.kyc.status === 'ManualReview'
                          ? 'badge border border-warning text-warning px-2 py-1 fs-13'
                          : 'badge border border-danger text-danger px-2 py-1 fs-13'
                    }
                  >
                    {item.kyc.status === 'ManualReview' ? 'Needs manual review' : item.kyc.status}
                  </span>
                </div>

                {/*
                  The check is the applicant's, not this submission's — say so, or
                  the reviewer reads it as evidence that was filed with the form.
                */}
                {!item.kycLinkedToApplication ? (
                  <p className="text-primary fs-13 mb-2">
                    <IconifyIcon icon="solar:info-circle-bold" className="me-1 align-middle" />
                    This identity check belongs to the applicant but was completed
                    {item.kyc.createdAt ? ` on ${formatDate(item.kyc.createdAt)}` : ''}, after this
                    application was submitted. It was not filed with the form.
                  </p>
                ) : null}

                {item.kyc.provider === 'MANUAL' ? (
                  <p className="text-danger fs-13 mb-2">
                    <i className="ti ti-alert-triangle me-1" aria-hidden />
                    <strong>No automated check ran.</strong> The eKYC provider was unavailable, so
                    nothing below was machine-read. Read the documents yourself and confirm the
                    portrait matches the card before approving.
                  </p>
                ) : item.kyc.status === 'ManualReview' ? (
                  <p className="text-warning fs-13 mb-2">
                    {item.kyc.failureReason ||
                      'The face comparison was inconclusive — check the photos yourself before approving.'}
                  </p>
                ) : null}

                {item.kyc.isMock ? (
                  <p className="text-danger fs-13 mb-2">
                    <i className="ti ti-alert-triangle me-1" aria-hidden />
                    This record came from the local mock, not a real identity check.
                  </p>
                ) : null}

                <div className="row g-3 mb-2">
                  <div className="col-sm-6">
                    <p className="text-muted mb-1 fs-13">Name on document</p>
                    <p className="mb-0">{item.kyc.fullName || 'Not read — verify from the photos'}</p>
                  </div>
                  <div className="col-sm-6">
                    <p className="text-muted mb-1 fs-13">Document</p>
                    <p className="mb-0">
                      {item.kyc.documentType || 'ID'} ·{' '}
                      {item.kyc.documentNumberMask || 'Not read — verify from the photos'}
                    </p>
                  </div>
                  <div className="col-sm-6">
                    <p className="text-muted mb-1 fs-13">Date of birth</p>
                    <p className="mb-0">{item.kyc.dateOfBirth || 'Not read — verify from the photos'}</p>
                  </div>
                  <div className="col-sm-6">
                    <p className="text-muted mb-1 fs-13">Face match</p>
                    <p className="mb-0">
                      {item.kyc.faceMatchSimilarity != null
                        ? `${(item.kyc.faceMatchSimilarity * 100).toFixed(1)}%`
                        : 'Not compared — check by eye'}
                    </p>
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  {[
                    { url: item.kyc.frontImageUrl, label: 'ID front' },
                    { url: item.kyc.backImageUrl, label: 'ID back' },
                    { url: item.kyc.selfieImageUrl, label: 'Portrait' },
                  ]
                    .filter((x) => Boolean(x.url))
                    .map((x) => (
                      <a
                        key={x.label}
                        href={x.url!}
                        target="_blank"
                        rel="noreferrer"
                        className="d-block"
                        title={x.label}
                      >
                        <img
                          src={x.url!}
                          alt={x.label}
                          style={{
                            width: 110,
                            height: 74,
                            objectFit: 'cover',
                            borderRadius: 8,
                          }}
                        />
                      </a>
                    ))}
                </div>
              </div>
            ) : (
              <div className="alert alert-warning" role="alert">
                <strong>No identity check on file for this applicant.</strong> This application
                predates eKYC and the applicant has never verified — read the documents yourself
                and treat it with extra care.
              </div>
            )}

            {item.licenseImageUrl ? (
              <div className="mb-3">
                <p className="text-muted mb-2">Business licence</p>
                <a href={item.licenseImageUrl} target="_blank" rel="noreferrer">
                  <img
                    src={item.licenseImageUrl}
                    alt="Business licence"
                    style={{ maxWidth: 220, borderRadius: 8 }}
                  />
                </a>
              </div>
            ) : null}

            <div className="mb-3">
              <p className="text-muted mb-2">Documents</p>
              {item.documentUrls.length === 0 ? (
                <p className="text-muted mb-0">No documents uploaded.</p>
              ) : (
                <div className="d-flex gap-2 flex-wrap">
                  {item.documentUrls.map((url, index) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="reg-doc"
                      title={url}
                    >
                      {/^https?:\/\/\S+\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ? (
                        <img src={url} alt={`Document ${index + 1}`} />
                      ) : (
                        <span className="reg-doc__file">
                          <IconifyIcon
                            icon="solar:document-bold-duotone"
                            className="fs-24 align-middle"
                          />
                        </span>
                      )}
                      <span className="reg-doc__label">Document {index + 1}</span>
                    </a>
                  ))}
                </div>
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
        <div className="card reg-decision">
          <div className="card-header">
            <h4 className="card-title mb-0">Review decision</h4>
          </div>
          <div className="card-body">
            {!isPending ? (
              <p className="text-muted mb-0">
                This request is <strong>{statusLabel(item.status)}</strong> — no further action is
                available.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-success w-100"
                  disabled={mutating}
                  onClick={() => setApproveOpen(true)}
                >
                  <IconifyIcon icon="solar:check-circle-bold" className="me-1 align-middle" />
                  Approve
                </button>
                <p className="text-muted fs-12 mt-2 mb-0">
                  Grants the Seller role and creates the shop and wallet.
                </p>

                {/*
                  The note belongs to the two actions below, not to Approve — the
                  divider and the caption say so, because a lone textarea under a
                  green button reads as if it applied to the approval.
                */}
                <div className="reg-decision__divider">
                  <span>or send it back</span>
                </div>

                <form onSubmit={handleRejectSubmit}>
                  <FormField label="Note to the applicant" htmlFor="adminNote" error={visibleNoteError}>
                    <textarea
                      id="adminNote"
                      className="form-control"
                      rows={4}
                      maxLength={SELLER_REGISTRATION_MAX_ADMIN_NOTE}
                      value={adminNote}
                      placeholder="Tell them what is wrong or what is missing..."
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
                    Required for both actions below · {adminNote.trim().length}/
                    {SELLER_REGISTRATION_MAX_ADMIN_NOTE}
                  </p>

                  <button
                    type="button"
                    className="btn btn-outline-warning w-100"
                    disabled={!canSendBack}
                    onClick={() => openSendBack('info')}
                  >
                    Ask for changes
                  </button>
                  <p className="text-muted fs-12 mt-2 mb-3">
                    Keeps the identity check. They can edit and resubmit.
                  </p>

                  <button type="submit" className="btn btn-outline-danger w-100" disabled={!canSendBack}>
                    Reject
                  </button>
                  <p className="text-muted fs-12 mt-2 mb-0">
                    Closes the application. No shop is created.
                  </p>
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
        open={infoOpen}
        title="Ask for changes"
        confirmLabel="Send back"
        confirmVariant="warning"
        confirming={mutating}
        onCancel={() => setInfoOpen(false)}
        onConfirm={() => void confirmRequestInfo()}
      >
        <p className="mb-2">
          Send <strong>{item.shopName}</strong> back to the applicant?
        </p>
        <p className="text-muted mb-2">
          They keep their identity check and can edit and resubmit. Your note:
        </p>
        <div className="bg-light-subtle border rounded p-2">
          <p className="mb-0">{adminNote.trim()}</p>
        </div>
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
