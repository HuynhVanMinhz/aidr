import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useAdminSellerRegistrations } from '../../hooks/useAdminSellerRegistrations';
import type { SellerRegistrationStatusFilter } from '../../types/admin';
import { sellerRegistrationBadgeClass } from '../../utils/adminBadge';

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: SellerRegistrationStatusFilter; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function AdminSellerRegistrationListPage() {
  const [status, setStatus] = useState<SellerRegistrationStatusFilter>('Pending');
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

  const { items, loading, error, summary, totalCount, page: serverPage } = useAdminSellerRegistrations({
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
          : summary.pendingCount + summary.approvedCount + summary.rejectedCount;

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
            title="Approved"
            value={summary.approvedCount}
            unit="Sellers"
            icon="solar:shop-bold-duotone"
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
              <h4 className="card-title mb-0">Seller Registration Requests</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <AdminSelect
                  id="seller-registration-status"
                  size="sm"
                  block={false}
                  menuAlign="end"
                  value={status}
                  options={STATUS_FILTERS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(next) => setStatus(next as SellerRegistrationStatusFilter)}
                />
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search shop / applicant..."
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
                    <th>Shop</th>
                    <th>Applicant</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        No seller registration requests found.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((item) => (
                    <tr key={item.requestId}>
                      <td>
                        <p className="text-dark fw-medium fs-15 mb-0">{item.shopName}</p>
                        {item.businessInfo ? (
                          <p className="text-muted mb-0 fs-13 text-truncate" style={{ maxWidth: 280 }}>
                            {item.businessInfo}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <p className="mb-0 fw-medium">{item.userFullName}</p>
                        <p className="text-muted mb-0 fs-13">{item.userEmail}</p>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <span className={sellerRegistrationBadgeClass(item.status)}>{item.status}</span>
                      </td>
                      <td>
                        <Link
                          to={`/admin/seller-registrations/${item.requestId}`}
                          className="btn btn-light btn-sm"
                          title="Review"
                        >
                          <IconifyIcon icon="solar:eye-broken" className="align-middle fs-18" />
                        </Link>
                      </td>
                    </tr>
                  ))}
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
    </>
  );
}
