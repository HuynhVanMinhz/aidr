import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { useToast } from '../../hooks/useToast';
import * as reviewApi from '../../services/reviewApi';
import type {
  AdminReviewModerationItem,
  AdminReviewModerationStatusFilter,
} from '../../types/review';
import { reviewModerationBadgeClass } from '../../utils/adminBadge';
import { getApiErrorMessage } from '../../utils/apiError';
import { parseUtcDate } from '../../utils/dateUtc';

const PAGE_SIZE = 8;

const STATUS_FILTERS: { value: AdminReviewModerationStatusFilter; label: string }[] = [
  { value: 'Reported', label: 'Reported' },
  { value: 'PendingTrust', label: 'Pending trust' },
  { value: 'all', label: 'All' },
];

function formatDate(value: string) {
  const date = parseUtcDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function StarRow({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.floor(rating)));
  return (
    <ul className="d-flex text-warning m-0 fs-20 list-unstyled">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index}>
          <i className={index < full ? 'bx bxs-star' : 'bx bx-star'} />
        </li>
      ))}
    </ul>
  );
}

function reporterLabel(item: AdminReviewModerationItem): string {
  if (!item.latestReporterName) return 'No open report';
  if (item.latestReporterIsShopOwner) return 'Shop owner';
  return 'Buyer / user';
}

export function AdminReviewModerationPage() {
  const toast = useToast();
  const [status, setStatus] = useState<AdminReviewModerationStatusFilter>('Reported');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminReviewModerationItem[]>([]);
  const [pendingTrustCount, setPendingTrustCount] = useState(0);
  const [reportedCount, setReportedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reviewApi.getAdminReviewModeration({
        status,
        q: debouncedQ,
        page,
        pageSize: PAGE_SIZE,
      });
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Unable to load review moderation queue.');
      }
      setItems(result.data.items);
      setPendingTrustCount(result.data.summary.pendingTrustCount);
      setReportedCount(result.data.summary.reportedCount);
      setTotalCount(result.data.totalCount);
      if (result.data.page !== page) setPage(result.data.page);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load review moderation queue.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(reviewId: string) {
    setMutatingId(reviewId);
    try {
      const result = await reviewApi.approveAdminReview(reviewId);
      if (!result.success) throw new Error(result.message || 'Unable to approve review.');
      toast.success('Review approved and restored to rating.');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to approve review.'));
    } finally {
      setMutatingId(null);
    }
  }

  async function handleHide(reviewId: string) {
    const confirmed = window.confirm('Hide this review from the product page?');
    if (!confirmed) return;
    setMutatingId(reviewId);
    try {
      const result = await reviewApi.hideAdminReview(reviewId);
      if (!result.success) throw new Error(result.message || 'Unable to hide review.');
      toast.success('Review hidden.');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to hide review.'));
    } finally {
      setMutatingId(null);
    }
  }

  const viewTotal =
    status === 'PendingTrust'
      ? pendingTrustCount
      : status === 'Reported'
        ? reportedCount
        : pendingTrustCount + reportedCount;

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="In This View"
            value={debouncedQ ? totalCount : viewTotal}
            unit="Reviews"
            icon="solar:chat-square-like-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Reported"
            value={reportedCount}
            unit="Queue"
            icon="solar:danger-triangle-bold-duotone"
            tone="danger"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Pending Trust"
            value={pendingTrustCount}
            unit="Held"
            icon="solar:hourglass-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Open reports"
            value={reportedCount + pendingTrustCount}
            unit="Total"
            icon="solar:clipboard-list-bold-duotone"
            tone="info"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">Review Moderation Queue</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <AdminSelect
                  id="admin-review-status"
                  size="sm"
                  block={false}
                  menuAlign="end"
                  value={status}
                  options={STATUS_FILTERS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(next) => setStatus(next as AdminReviewModerationStatusFilter)}
                />
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search product / shop / buyer..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 240, flex: '0 0 auto' }}
                />
              </div>
            </div>

            {error ? (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {error}
              </div>
            ) : null}

            <div className="card-body">
              {loading && items.length === 0 ? (
                <p className="text-center text-muted py-4 mb-0">Loading...</p>
              ) : null}
              {!loading && items.length === 0 ? (
                <p className="text-center text-muted py-4 mb-0">No reviews in this queue.</p>
              ) : null}

              <div className="row">
                {items.map((item) => (
                  <div key={item.reviewId} className="col-xl-3 col-md-6">
                    <div className="card overflow-hidden">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <p className="mb-0 text-dark fw-semibold fs-15">
                            Reviewed on {formatDate(item.createdAt)}
                          </p>
                          <span className={reviewModerationBadgeClass(item.moderationStatus)}>
                            {item.moderationStatus}
                          </span>
                        </div>
                        <p className="mb-1 text-muted fs-13">
                          <Link to={`/products/${item.productId}`} className="text-dark fw-medium">
                            {item.productName}
                          </Link>
                          <span className="mx-1">·</span>
                          {item.shopName}
                        </p>
                        {item.title ? (
                          <p className="fw-medium mb-1 text-dark fs-15">{item.title}</p>
                        ) : null}
                        <p className="mb-0">
                          {item.content
                            ? `"${item.content.length > 180 ? `${item.content.slice(0, 180)}…` : item.content}"`
                            : '—'}
                        </p>
                        <div className="d-flex align-items-center gap-2 mt-2 mb-1">
                          <StarRow rating={item.rating} />
                          <p className="fw-medium mb-0 text-dark fs-15">{item.rating}/5</p>
                        </div>

                        {item.openReportCount > 0 ? (
                          <div className="mt-2 p-2 rounded bg-light-subtle">
                            <p className="mb-1 fs-13 fw-medium text-dark">
                              Report ({item.openReportCount}): {item.latestReportReason || '—'}
                            </p>
                            <p className="mb-1 fs-13 text-muted">
                              By {item.latestReporterName || 'Unknown'}
                              {item.latestReporterEmail ? ` · ${item.latestReporterEmail}` : ''}
                            </p>
                            <span
                              className={
                                item.latestReporterIsShopOwner
                                  ? 'badge border border-primary text-primary'
                                  : 'badge border border-secondary text-secondary'
                              }
                            >
                              {reporterLabel(item)}
                            </span>
                            {item.latestReportDetails ? (
                              <p className="mb-0 mt-1 fs-13 text-muted">{item.latestReportDetails}</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mb-0 mt-2 fs-13 text-muted">
                            Trust hold
                            {item.trustReleaseAt ? ` · release ${formatDate(item.trustReleaseAt)}` : ''}
                          </p>
                        )}

                        <div className="d-flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={mutatingId === item.reviewId}
                            onClick={() => void handleApprove(item.reviewId)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            disabled={mutatingId === item.reviewId}
                            onClick={() => void handleHide(item.reviewId)}
                          >
                            Hide
                          </button>
                        </div>
                      </div>
                      <div className="card-footer bg-primary position-relative mt-3">
                        <div className="position-absolute top-0 start-0 translate-middle-y ms-3">
                          <div className="avatar-lg border border-light border-3 rounded-circle bg-white d-flex align-items-center justify-content-center">
                            <span className="fw-semibold text-dark">
                              {(item.buyerName || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-white mb-1">{item.buyerName}</h4>
                          <p className="text-white mb-0">
                            {item.buyerEmail || 'Buyer'} · {item.shopName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <AdminPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={totalCount}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>
    </>
  );
}
