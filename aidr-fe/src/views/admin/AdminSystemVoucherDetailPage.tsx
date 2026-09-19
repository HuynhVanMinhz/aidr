import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAdminSystemVoucher } from '../../services/voucherApi';
import type { AdminSystemVoucher } from '../../types/admin';
import { adminBadgeClass, categoryVisibilityBadgeClass } from '../../utils/adminBadge';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatMoney } from '../../utils/formatCatalog';

function formatDiscount(item: AdminSystemVoucher) {
  if (item.discountType.toLowerCase() === 'percent') {
    const cap =
      item.maxDiscountAmount != null
        ? ` (max ${formatMoney(item.maxDiscountAmount, 'VND')})`
        : '';
    return `${item.discountValue}%${cap}`;
  }
  return formatMoney(item.discountValue, 'VND');
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function AdminSystemVoucherDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [item, setItem] = useState<AdminSystemVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAdminSystemVoucher(id)
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          throw new Error(result.message || 'Voucher not found.');
        }
        setItem(result.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <div className="alert alert-danger" role="alert">
        Voucher id is required.{' '}
        <Link to="/admin/vouchers" className="alert-link">
          Back to vouchers
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="text-muted">Loading voucher…</p>;
  }

  if (error || !item) {
    return (
      <div className="alert alert-danger" role="alert">
        {error || 'Voucher not found.'}{' '}
        <Link to="/admin/vouchers" className="alert-link">
          Back to vouchers
        </Link>
      </div>
    );
  }

  const expired = new Date(item.endsAt).getTime() < Date.now();

  return (
    <div className="row">
      <div className="col-xl-12">
        <div className="card">
          <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h4 className="card-title mb-1">{item.name}</h4>
              <span className={adminBadgeClass.solidLight}>{item.code}</span>
            </div>
            <div className="d-flex gap-2">
              <Link to="/admin/vouchers" className="btn btn-outline-light">
                Back
              </Link>
              <Link to={`/admin/vouchers/${item.voucherId}/edit`} className="btn btn-primary">
                Edit
              </Link>
            </div>
          </div>
          <div className="card-body">
            <div className="row g-4">
              <div className="col-md-6">
                <p className="text-muted mb-1">Status</p>
                <div className="d-flex align-items-center gap-2">
                  <span className={categoryVisibilityBadgeClass(item.isActive)}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {expired ? (
                    <span className={adminBadgeClass.outlineDanger}>Expired</span>
                  ) : null}
                </div>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Scope</p>
                <p className="mb-0 fw-medium">{item.scope}</p>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Discount</p>
                <p className="mb-0 fw-medium">
                  {formatDiscount(item)} ({item.discountType})
                </p>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Minimum order</p>
                <p className="mb-0 fw-medium">{formatMoney(item.minOrderAmount, 'VND')}</p>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Usage</p>
                <p className="mb-0 fw-medium">
                  {item.usedCount}
                  {item.usageLimit != null ? ` / ${item.usageLimit}` : ' / ∞'} total ·{' '}
                  {item.perUserLimit} per user
                </p>
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Valid period</p>
                <p className="mb-0 fw-medium">
                  {formatDate(item.startsAt)} - {formatDate(item.endsAt)}
                </p>
              </div>
              {item.description ? (
                <div className="col-12">
                  <p className="text-muted mb-1">Description</p>
                  <p className="mb-0">{item.description}</p>
                </div>
              ) : null}
              <div className="col-md-6">
                <p className="text-muted mb-1">Created</p>
                <p className="mb-0">{formatDate(item.createdAt)}</p>
                {item.createdByName ? (
                  <p className="text-muted mb-0 fs-13">by {item.createdByName}</p>
                ) : null}
              </div>
              <div className="col-md-6">
                <p className="text-muted mb-1">Last updated</p>
                <p className="mb-0">{formatDate(item.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
