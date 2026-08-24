import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminSellerRegistrations } from '../../hooks/useAdminSellerRegistrations';
import type { SellerRegistrationStatusFilter } from '../../types/admin';

const STATUS_FILTERS: { value: SellerRegistrationStatusFilter; label: string }[] = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

function statusBadgeClass(status: string) {
  switch (status) {
    case 'Approved':
      return 'badge bg-success-subtle text-success';
    case 'Rejected':
      return 'badge bg-danger-subtle text-danger';
    default:
      return 'badge bg-warning-subtle text-warning';
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function AdminSellerRegistrationListPage() {
  const [status, setStatus] = useState<SellerRegistrationStatusFilter>('Pending');
  const [q, setQ] = useState('');
  const { items, loading, error } = useAdminSellerRegistrations(status);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.shopName.toLowerCase().includes(term) ||
        item.userEmail.toLowerCase().includes(term) ||
        item.userFullName.toLowerCase().includes(term),
    );
  }, [items, q]);

  const stats = useMemo(() => {
    const pending = items.filter((i) => i.status === 'Pending').length;
    const approved = items.filter((i) => i.status === 'Approved').length;
    const rejected = items.filter((i) => i.status === 'Rejected').length;
    return { total: items.length, pending, approved, rejected };
  }, [items]);

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-1">{stats.total}</h3>
              <p className="text-muted mb-0">In this view</p>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3">
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-1">{stats.pending}</h3>
              <p className="text-muted mb-0">Pending</p>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3">
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-1">{stats.approved}</h3>
              <p className="text-muted mb-0">Approved</p>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3">
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-1">{stats.rejected}</h3>
              <p className="text-muted mb-0">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">Seller Registration Requests</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <select
                  className="form-select form-select-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SellerRegistrationStatusFilter)}
                  aria-label="Filter by status"
                  style={{ width: 140, flex: '0 0 auto' }}
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        No seller registration requests found.
                      </td>
                    </tr>
                  ) : null}
                  {filtered.map((item) => (
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
                        <span className={statusBadgeClass(item.status)}>{item.status}</span>
                      </td>
                      <td>
                        <Link
                          to={`/admin/seller-registrations/${item.requestId}`}
                          className="btn btn-soft-primary btn-sm"
                          title="Review"
                        >
                          <i className="bx bx-show align-middle fs-18" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
