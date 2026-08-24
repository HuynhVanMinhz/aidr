import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { FormField } from '../../components/admin/FormField';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import {
  useAdminProductDetail,
  useAdminProducts,
  useProductModerationHistory,
} from '../../hooks/useAdminProducts';
import { useToast } from '../../hooks/useToast';
import {
  moderationActionBadgeClass,
  productModerationBadgeClass,
} from '../../utils/adminBadge';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';
import {
  PRODUCT_MODERATION_MAX_REASON,
  validateProductRejectReason,
} from '../../utils/productModerationValidation';
import { formatDateTime, formatVnd } from '../../utils/sellerProductUi';

export function AdminProductDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const cached = useAdminProductDetail(id);
  const cachedHistory = useProductModerationHistory(id);
  const { loadOne, loadHistory, approve, reject, mutating } = useAdminProducts('Pending', {
    autoLoad: false,
  });

  const [item, setItem] = useState(cached);
  const [history, setHistory] = useState(cachedHistory);
  const [loading, setLoading] = useState(!cached);
  const [historyLoading, setHistoryLoading] = useState(!cachedHistory);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [reason, setReason] = useState('');
  const [reasonDirty, setReasonDirty] = useState(false);
  const [reasonTouched, setReasonTouched] = useState(false);
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
          setLoadError(err instanceof Error ? err.message : 'Product not found.');
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
    if (!id) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    void loadHistory(id)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error ? err.message : 'Unable to load moderation history.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadHistory]);

  useEffect(() => {
    if (cached) setItem(cached);
  }, [cached]);

  useEffect(() => {
    if (cachedHistory) setHistory(cachedHistory);
  }, [cachedHistory]);

  const reasonError = useMemo(
    () => tryValidateField(() => validateProductRejectReason(reason)),
    [reason],
  );
  const visibleReasonError = visibleFieldErrors(
    { reason: reasonError },
    { reason: reasonTouched },
    rejectSubmitted,
  ).reason;

  const canReject =
    Boolean(item && item.status === 'Pending') && reasonDirty && !reasonError && !mutating;

  const isPending = item?.status === 'Pending';
  const primaryImage =
    item?.images.find((img) => img.isPrimary)?.imageUrl ?? item?.images[0]?.imageUrl;

  async function refreshHistory() {
    if (!id) return;
    try {
      const data = await loadHistory(id);
      setHistory(data);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : 'Unable to load moderation history.',
      );
    }
  }

  async function confirmApprove() {
    if (!item || !isPending) return;

    setActionError(null);
    try {
      const updated = await approve(item.productId);
      setItem(updated);
      setApproveOpen(false);
      toast.success('Product approved.');
      await refreshHistory();
      navigate('/admin/products');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to approve product.';
      setActionError(message);
      toast.error(message);
    }
  }

  function handleRejectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!item || !isPending) return;
    setRejectSubmitted(true);
    setReasonTouched(true);
    if (reasonError) return;
    setRejectOpen(true);
  }

  async function confirmReject() {
    if (!item || !isPending || reasonError) return;

    setActionError(null);
    try {
      const updated = await reject(item.productId, { reason: reason.trim() });
      setItem(updated);
      setRejectOpen(false);
      toast.success('Product rejected.');
      await refreshHistory();
      navigate('/admin/products');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reject product.';
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
        {loadError || 'Product not found.'}{' '}
        <Link to="/admin/products" className="alert-link">
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
              <h4 className="card-title mb-1">{item.name}</h4>
              <span className={productModerationBadgeClass(item.status)}>{item.status}</span>
            </div>
            <Link to="/admin/products" className="btn btn-sm btn-light">
              Back to list
            </Link>
          </div>
          <div className="card-body">
            {actionError ? (
              <div className="alert alert-danger" role="alert">
                {actionError}
              </div>
            ) : null}

            <div className="d-flex flex-wrap gap-3 mb-4">
              <div className="rounded bg-light d-flex align-items-center justify-content-center overflow-hidden"
                style={{ width: 120, height: 120 }}
              >
                {primaryImage ? (
                  <img
                    src={primaryImage}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <IconifyIcon icon="solar:gallery-bold-duotone" className="fs-36 text-muted" />
                )}
              </div>
              <div className="flex-grow-1">
                <div className="row g-3">
                  <div className="col-md-6">
                    <p className="text-muted mb-1">Shop</p>
                    <p className="mb-0 fw-medium">{item.shopName}</p>
                  </div>
                  <div className="col-md-6">
                    <p className="text-muted mb-1">Category</p>
                    <p className="mb-0 fw-medium">{item.categoryName}</p>
                  </div>
                  <div className="col-md-6">
                    <p className="text-muted mb-1">Price</p>
                    <p className="mb-0 fw-medium">{formatVnd(item.effectivePrice)}</p>
                    {item.salePrice != null && item.salePrice < item.basePrice ? (
                      <p className="text-muted mb-0 text-decoration-line-through fs-13">
                        {formatVnd(item.basePrice)}
                      </p>
                    ) : null}
                  </div>
                  <div className="col-md-6">
                    <p className="text-muted mb-1">Stock</p>
                    <p className="mb-0">
                      {item.stockQuantity} available
                      {item.reservedQuantity > 0
                        ? ` · ${item.reservedQuantity} reserved`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <p className="text-muted mb-1">Brand</p>
                <p className="mb-0">{item.brand?.trim() || '—'}</p>
              </div>
              <div className="col-md-4">
                <p className="text-muted mb-1">Model</p>
                <p className="mb-0">{item.modelNumber?.trim() || '—'}</p>
              </div>
              <div className="col-md-4">
                <p className="text-muted mb-1">Condition</p>
                <p className="mb-0">{item.conditionType}</p>
              </div>
              <div className="col-md-4">
                <p className="text-muted mb-1">Origin</p>
                <p className="mb-0">{item.originCountry?.trim() || '—'}</p>
              </div>
              <div className="col-md-4">
                <p className="text-muted mb-1">Warranty</p>
                <p className="mb-0">
                  {item.warrantyMonths != null ? `${item.warrantyMonths} months` : '—'}
                </p>
              </div>
              <div className="col-md-4">
                <p className="text-muted mb-1">Published</p>
                <p className="mb-0">{formatDateTime(item.publishedAt)}</p>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-1">Short description</p>
              <p className="mb-0">{item.shortDescription?.trim() || '—'}</p>
            </div>

            <div className="mb-3">
              <p className="text-muted mb-1">Description</p>
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                {item.description?.trim() || '—'}
              </p>
            </div>

            {item.images.length > 0 ? (
              <div className="mb-3">
                <p className="text-muted mb-2">Images</p>
                <div className="d-flex flex-wrap gap-2">
                  {item.images.map((img) => (
                    <a
                      key={img.productImageId}
                      href={img.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border overflow-hidden d-block"
                      style={{ width: 72, height: 72 }}
                    >
                      <img
                        src={img.imageUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-top pt-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">Moderation history</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  disabled={historyLoading}
                  onClick={() => void refreshHistory()}
                >
                  Refresh
                </button>
              </div>
              {historyError ? (
                <div className="alert alert-danger mb-0" role="alert">
                  {historyError}
                </div>
              ) : null}
              {historyLoading && !history ? (
                <p className="text-muted mb-0">Loading history...</p>
              ) : null}
              {!historyLoading && (!history || history.items.length === 0) ? (
                <p className="text-muted mb-0">No moderation actions yet.</p>
              ) : null}
              {history && history.items.length > 0 ? (
                <ul className="list-unstyled mb-0">
                  {history.items.map((entry) => (
                    <li
                      key={entry.moderationId}
                      className="border rounded p-3 mb-2 bg-light-subtle"
                    >
                      <div className="d-flex flex-wrap justify-content-between gap-2 mb-1">
                        <span className={moderationActionBadgeClass(entry.action)}>
                          {entry.action}
                        </span>
                        <span className="text-muted fs-13">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mb-1 fw-medium">
                        {entry.fromStatus} → {entry.toStatus}
                      </p>
                      <p className="text-muted mb-0 fs-13">
                        By {entry.adminFullName}
                        {entry.reason ? ` · ${entry.reason}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-4">
        <div className="card">
          <div className="card-header">
            <h4 className="card-title mb-0">Moderation decision</h4>
          </div>
          <div className="card-body">
            {!isPending ? (
              <p className="text-muted mb-0">
                Only pending products can be approved or rejected.
              </p>
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
                  <FormField label="Rejection reason" htmlFor="reason" error={visibleReasonError}>
                    <textarea
                      id="reason"
                      className="form-control"
                      rows={4}
                      maxLength={PRODUCT_MODERATION_MAX_REASON}
                      value={reason}
                      placeholder="Explain why this product is rejected..."
                      onChange={(e) => {
                        setReason(e.target.value);
                        setReasonDirty(true);
                      }}
                      onBlur={() => {
                        if (reasonDirty) setReasonTouched(true);
                      }}
                    />
                  </FormField>
                  <p className="text-muted fs-12 mb-3">
                    {reason.trim().length}/{PRODUCT_MODERATION_MAX_REASON}
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
        title="Approve product"
        confirmLabel="Approve"
        confirmVariant="success"
        confirming={mutating}
        onCancel={() => setApproveOpen(false)}
        onConfirm={() => void confirmApprove()}
      >
        <p className="mb-2">
          Approve <strong>{item.name}</strong>?
        </p>
        <p className="text-muted mb-0">
          The product will become visible in the public catalog when its category is active.
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={rejectOpen}
        title="Reject product"
        confirmLabel="Reject"
        confirmVariant="danger"
        confirming={mutating}
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => void confirmReject()}
      >
        <p className="mb-2">
          Reject <strong>{item.name}</strong>?
        </p>
        <p className="text-muted mb-2">The seller will see your reason:</p>
        <div className="bg-light-subtle border rounded p-2">
          <p className="mb-0">{reason.trim()}</p>
        </div>
      </AdminConfirmModal>
    </div>
  );
}
