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
  { value: 'NeedsMoreInfo', label: 'Waiting on applicant' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

/**
 * Three states worth distinguishing at a glance: verified, needs a human, and
 * nothing on file. "Not filed with this form" is a footnote, not a warning -
 * the identity is still checked.
 */
function IdentityBadge({
  hasCheck,
  status,
  linked,
}: {
  hasCheck: boolean;
  status?: string | null;
  linked: boolean;
}) {
  if (!hasCheck) {
    return (
      <span
        className="badge bg-warning-subtle text-warning px-2 py-1 fs-13"
        title="This applicant has never verified their identity - read the documents by hand."
      >
        <IconifyIcon icon="solar:shield-cross-bold" className="me-1 align-middle" />
        None
      </span>
    );
  }

  const passed = status === 'Passed';

  return (
    <span
      className={`badge px-2 py-1 fs-13 ${
        passed ? 'bg-success-subtle text-success' : 'bg-primary-subtle text-primary'
      }`}
      title={
        linked
          ? undefined
          : 'Verified by this applicant, but after this application was submitted.'
      }
    >
      <IconifyIcon
        icon={passed ? 'solar:shield-check-bold' : 'solar:shield-warning-bold'}
        className="me-1 align-middle"
      />
      {passed ? 'Verified' : 'Needs review'}
      {linked ? '' : ' *'}
    </span>
  );
}

function statusLabel(status: string) {
  return status === 'NeedsMoreInfo' ? 'Waiting on applicant' : status;
}

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

  const allTotal = summary.pendingCount + summary.approvedCount + summary.rejectedCount;

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Awaiting review"
            value={summary.pendingCount}
            unit="In the queue"
            icon="solar:hourglass-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Approved"
            value={summary.approvedCount}
            unit="Selling now"
            icon="solar:shop-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Rejected"
            value={summary.rejectedCount}
            unit="Turned down"
            icon="solar:close-circle-bold-duotone"
            tone="danger"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="All applications"
            value={allTotal}
            unit="Since launch"
            icon="solar:clipboard-list-bold-duotone"
            tone="primary"
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
                    <th>Identity</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
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
                      <td>
                        <IdentityBadge
                          hasCheck={item.hasIdentityCheck}
                          status={item.kycStatus}
                          linked={item.kycLinkedToApplication}
                        />
                      </td>
                      <td className="text-nowrap">{formatDate(item.createdAt)}</td>
                      <td>
                        <span className={sellerRegistrationBadgeClass(item.status)}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="text-end">
                        <Link
                          to={`/admin/seller-registrations/${item.requestId}`}
                          className="btn btn-light btn-sm text-nowrap"
                        >
                          <IconifyIcon icon="solar:eye-broken" className="align-middle me-1" />
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {items.some((x) => x.hasIdentityCheck && !x.kycLinkedToApplication) ? (
              <p className="text-muted fs-12 px-3 pt-3 mb-0">
                * Identity verified by the applicant, but after that application was submitted.
              </p>
            ) : null}

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
