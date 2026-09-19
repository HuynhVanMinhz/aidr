import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useAdminProducts } from '../../hooks/useAdminProducts';
import { useToast } from '../../hooks/useToast';
import type { AdminProductStatusFilter } from '../../types/admin';
import { productModerationBadgeClass } from '../../utils/adminBadge';
import { formatVnd } from '../../utils/sellerProductUi';
import { parseUtcDate } from '../../utils/dateUtc';

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: AdminProductStatusFilter; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

function formatDate(value: string) {
  const date = parseUtcDate(value);
  if (!date) return value;
  return date.toLocaleString();
}

export function AdminProductListPage() {
  const toast = useToast();
  const [status, setStatus] = useState<AdminProductStatusFilter>('Pending');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmingBulk, setConfirmingBulk] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedQ, status, page]);

  const {
    items,
    loading,
    error,
    summary,
    totalCount,
    page: serverPage,
    mutating,
    approveBulk,
    reload,
  } = useAdminProducts({
    status,
    q: debouncedQ,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    if (serverPage !== page) setPage(serverPage);
  }, [serverPage, page]);

  const pendingOnPage = useMemo(
    () => items.filter((item) => item.status === 'Pending'),
    [items],
  );
  const pendingIds = useMemo(() => pendingOnPage.map((item) => item.productId), [pendingOnPage]);
  const canBulk = status === 'Pending' || status === 'all';
  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selectedIds.includes(id));

  const viewTotal =
    status === 'Pending'
      ? summary.pendingCount
      : status === 'Approved'
        ? summary.approvedCount
        : status === 'Rejected'
          ? summary.rejectedCount
          : summary.pendingCount + summary.approvedCount + summary.rejectedCount;

  function toggleOne(productId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, productId])] : current.filter((id) => id !== productId),
    );
  }

  function toggleAllPending(checked: boolean) {
    setSelectedIds(checked ? pendingIds : []);
  }

  async function confirmBulkApprove() {
    if (selectedIds.length === 0) return;
    setConfirmingBulk(true);
    try {
      const result = await approveBulk(selectedIds);
      setBulkOpen(false);
      setSelectedIds([]);
      toast.success(
        result.approvedCount === 0
          ? 'No pending products were approved.'
          : `${result.approvedCount} product(s) approved.`,
      );
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to approve products.');
    } finally {
      setConfirmingBulk(false);
    }
  }

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="In This View"
            value={debouncedQ ? totalCount : viewTotal}
            unit="Products"
            icon="solar:clipboard-list-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Pending"
            value={summary.pendingCount}
            unit="Queue"
            icon="solar:hourglass-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Approved"
            value={summary.approvedCount}
            unit="Live"
            icon="solar:check-circle-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Rejected"
            value={summary.rejectedCount}
            unit="Denied"
            icon="solar:close-circle-bold-duotone"
            tone="danger"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">Product Moderation Queue</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                {canBulk ? (
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={selectedIds.length === 0 || mutating}
                    onClick={() => setBulkOpen(true)}
                  >
                    Approve selected ({selectedIds.length})
                  </button>
                ) : null}
                <AdminSelect
                  id="admin-product-status"
                  size="sm"
                  block={false}
                  menuAlign="end"
                  value={status}
                  options={STATUS_FILTERS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(next) => setStatus(next as AdminProductStatusFilter)}
                />
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search product / shop..."
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

            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle">
                  <tr>
                    {canBulk ? (
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label="Select all pending on this page"
                          checked={allPendingSelected}
                          disabled={pendingIds.length === 0}
                          onChange={(e) => toggleAllPending(e.target.checked)}
                        />
                      </th>
                    ) : null}
                    <th>Product</th>
                    <th>Shop</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Category</th>
                    <th>Updated</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={canBulk ? 9 : 8} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={canBulk ? 9 : 8} className="text-center py-4 text-muted">
                        No products found.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((item) => {
                    const isPending = item.status === 'Pending';
                    return (
                      <tr key={item.productId}>
                        {canBulk ? (
                          <td>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              aria-label={`Select ${item.name}`}
                              checked={selectedIds.includes(item.productId)}
                              disabled={!isPending}
                              onChange={(e) => toggleOne(item.productId, e.target.checked)}
                            />
                          </td>
                        ) : null}
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="rounded bg-light avatar-md d-flex align-items-center justify-content-center overflow-hidden">
                              {item.primaryImageUrl ? (
                                <img
                                  src={item.primaryImageUrl}
                                  alt=""
                                  className="avatar-md admin-product-thumb"
                                />
                              ) : (
                                <IconifyIcon
                                  icon="solar:gallery-bold-duotone"
                                  className="fs-24 text-muted"
                                />
                              )}
                            </div>
                            <div>
                              <p className="text-dark fw-medium fs-15 mb-0">{item.name}</p>
                              <p className="text-muted mb-0 fs-13">
                                {item.brand?.trim() || item.conditionType}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="mb-0 fw-medium">{item.shopName}</p>
                        </td>
                        <td>
                          <div>{formatVnd(item.effectivePrice)}</div>
                          {item.salePrice != null && item.salePrice < item.basePrice ? (
                            <div className="text-muted text-decoration-line-through fs-13">
                              {formatVnd(item.basePrice)}
                            </div>
                          ) : null}
                        </td>
                        <td>{item.stockQuantity}</td>
                        <td>{item.categoryName}</td>
                        <td>{formatDate(item.updatedAt)}</td>
                        <td>
                          <span className={productModerationBadgeClass(item.status)}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/admin/products/${item.productId}`}
                            className="btn btn-light btn-sm"
                            title="Review"
                          >
                            <IconifyIcon icon="solar:eye-broken" className="align-middle fs-18" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

      <AdminConfirmModal
        open={bulkOpen}
        title="Approve selected products"
        confirmLabel="Approve all"
        confirmVariant="success"
        confirming={confirmingBulk}
        onCancel={() => {
          if (!confirmingBulk) setBulkOpen(false);
        }}
        onConfirm={() => void confirmBulkApprove()}
      >
        <p className="mb-0">
          Approve <strong>{selectedIds.length}</strong> selected pending product
          {selectedIds.length === 1 ? '' : 's'}? They will become visible in the catalog.
        </p>
      </AdminConfirmModal>
    </>
  );
}
