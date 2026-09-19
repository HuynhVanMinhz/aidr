import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useAdminReturnRequests } from '../../hooks/useAdminReturnRequests';
import type { AdminReturnStatusFilter } from '../../types/return';
import { formatMoney } from '../../utils/formatCatalog';
import { parseUtcDate } from '../../utils/dateUtc';
import { formatReturnStatus, returnStatusBadgeClass } from '../../utils/returnUi';

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: AdminReturnStatusFilter; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'With seller' },
  { value: 'SellerConfirmed', label: 'Seller confirmed' },
  { value: 'Receiving', label: 'Receiving' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Exchanged', label: 'Exchanged' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

function formatDate(value: string) {
  const date = parseUtcDate(value);
  if (!date) return value;
  return date.toLocaleString();
}

export function AdminReturnRequestListPage() {
  const [status, setStatus] = useState<AdminReturnStatusFilter>('Pending');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  const { items, loading, error, summary, totalCount, page: serverPage } = useAdminReturnRequests({
    status,
    q: debouncedQ,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    if (serverPage !== page) setPage(serverPage);
  }, [serverPage, page]);

  const viewTotal =
    status === 'Pending'
      ? summary.pendingCount
      : status === 'Approved'
        ? summary.approvedCount
        : status === 'Rejected'
          ? summary.rejectedCount
          : status === 'SellerConfirmed'
            ? summary.sellerConfirmedCount
            : status === 'Receiving'
              ? summary.receivingCount
              : status === 'Accepted'
                ? summary.acceptedCount
                : status === 'Refunded'
                  ? summary.refundedCount
                  : status === 'Exchanged'
                    ? summary.exchangedCount
                    : status === 'Closed'
                      ? summary.closedCount
                      : summary.pendingCount +
                        summary.approvedCount +
                        summary.rejectedCount +
                        summary.sellerConfirmedCount +
                        summary.receivingCount +
                        summary.acceptedCount +
                        summary.refundedCount +
                        summary.exchangedCount +
                        summary.closedCount;

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="In This View"
            value={debouncedQ ? totalCount : viewTotal}
            unit="Requests"
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
            title="Receiving"
            value={summary.receivingCount}
            unit="In transit"
            icon="solar:box-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Accepted"
            value={summary.acceptedCount}
            unit="Awaiting complete"
            icon="solar:check-circle-bold-duotone"
            tone="success"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">All Return Items</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <AdminSelect
                  id="return-request-status"
                  size="sm"
                  block={false}
                  menuAlign="end"
                  value={status}
                  options={STATUS_FILTERS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(next) => setStatus(next as AdminReturnStatusFilter)}
                />
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search order / shop / buyer..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 260, flex: '0 0 auto' }}
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
                    <th>Order</th>
                    <th>Order By</th>
                    <th>Shop</th>
                    <th>Resolution</th>
                    <th>Return Date</th>
                    <th>Total</th>
                    <th>Return Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : null}

                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        No return requests found.
                      </td>
                    </tr>
                  ) : null}

                  {items.map((item) => (
                    <tr key={item.returnRequestId}>
                      <td>
                        <Link
                          to={`/admin/return-requests/${item.returnRequestId}`}
                          className="fw-medium link-primary"
                        >
                          {item.orderCode}
                        </Link>
                        <div className="text-muted fs-12 text-truncate" style={{ maxWidth: 220 }}>
                          {item.reason}
                        </div>
                      </td>
                      <td>
                        <div className="fw-medium">{item.buyerFullName}</div>
                        <div className="text-muted fs-12">{item.buyerEmail}</div>
                      </td>
                      <td>{item.shopName}</td>
                      <td>
                        {item.resolutionType === 'Exchange' ? 'Exchange' : 'Return & refund'}
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{formatMoney(item.orderTotalAmount, 'VND')}</td>
                      <td>
                        <span className={returnStatusBadgeClass(item.status)}>
                          {formatReturnStatus(item.status)}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/admin/return-requests/${item.returnRequestId}`}
                          className="btn btn-soft-primary btn-sm"
                          title="View"
                        >
                          <IconifyIcon icon="solar:eye-bold-duotone" className="align-middle fs-18" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-footer border-top">
              <AdminPagination
                page={page}
                pageSize={PAGE_SIZE}
                total={totalCount}
                onPageChange={setPage}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
