import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useAuth } from '../../hooks/useAuth';
import { useAdminAccounts } from '../../hooks/useAdminGovernance';
import { useToast } from '../../hooks/useToast';
import type { AdminAccount, AdminAccountRoleFilter, AdminAccountStatusFilter } from '../../types/admin';
import {
  ADMIN_ACCOUNT_ROLE_FILTERS,
  ADMIN_ACCOUNT_STATUS_FILTERS,
  accountStatusBadgeClass,
  canLockAccount,
  canUnlockAccount,
  formatAccountDateTime,
  formatAccountRole,
  formatLastLoginAt,
} from '../../utils/adminGovernanceUi';

const PAGE_SIZE = 10;

export function AdminAccountListPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState<AdminAccountStatusFilter>('all');
  const [role, setRole] = useState<AdminAccountRoleFilter>('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lockTarget, setLockTarget] = useState<AdminAccount | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, role]);

  const { items, loading, error, summary, totalCount, page: serverPage, lock, unlock, reload, mutating } =
    useAdminAccounts({
      status,
      role,
      q: debouncedQ,
      page,
      pageSize: PAGE_SIZE,
    });

  useEffect(() => {
    if (serverPage !== page) setPage(serverPage);
  }, [serverPage, page]);

  async function confirmLock() {
    if (!lockTarget) return;
    setActionError(null);
    setBusyId(lockTarget.userId);
    try {
      await lock(lockTarget.userId);
      await reload({ status, role, q: debouncedQ, page, pageSize: PAGE_SIZE });
      toast.success('Account locked.');
      setLockTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to lock account.';
      setActionError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnlock(item: AdminAccount) {
    setActionError(null);
    setBusyId(item.userId);
    try {
      await unlock(item.userId);
      await reload({ status, role, q: debouncedQ, page, pageSize: PAGE_SIZE });
      toast.success('Account unlocked.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to unlock account.';
      setActionError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Active"
            value={summary.activeCount}
            unit="Accounts"
            icon="solar:user-check-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Locked"
            value={summary.lockedCount}
            unit="Accounts"
            icon="solar:lock-keyhole-bold-duotone"
            tone="danger"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Buyers"
            value={summary.buyerCount}
            icon="solar:users-group-two-rounded-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Sellers"
            value={summary.sellerCount}
            icon="solar:shop-bold-duotone"
            tone="info"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">Accounts</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <AdminSelect
                  size="sm"
                  block={false}
                  menuAlign="end"
                  value={status}
                  options={ADMIN_ACCOUNT_STATUS_FILTERS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onChange={(next) => setStatus(next as AdminAccountStatusFilter)}
                />
                <AdminSelect
                  size="sm"
                  block={false}
                  menuAlign="end"
                  value={role}
                  options={ADMIN_ACCOUNT_ROLE_FILTERS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onChange={(next) => setRole(next as AdminAccountRoleFilter)}
                />
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search name, email, phone…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 240, flex: '0 0 auto' }}
                />
              </div>
            </div>

            {(error || actionError) && (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {actionError || error}
              </div>
            )}

            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle">
                  <tr>
                    <th>Account</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Last login</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        Loading accounts…
                      </td>
                    </tr>
                  ) : null}
                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        No accounts match the current filters.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((item) => {
                    const busy = busyId === item.userId;
                    const showLock = canLockAccount({
                      accountUserId: item.userId,
                      currentUserId: user?.userId,
                      status: item.status,
                      roles: item.roles,
                    });
                    const showUnlock = canUnlockAccount(item.status);

                    return (
                      <tr key={item.userId}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="avatar-sm rounded-circle bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0">
                              {item.fullName.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <Link
                                to={`/admin/accounts/${item.userId}`}
                                className="fw-medium text-dark"
                              >
                                {item.fullName}
                              </Link>
                              <p className="mb-0 text-muted fs-13">{item.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {item.roles.length === 0 ? (
                              <span className="text-muted">No roles assigned</span>
                            ) : (
                              item.roles.map((r) => (
                                <span key={r} className="badge bg-light text-dark">
                                  {formatAccountRole(r)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={accountStatusBadgeClass(item.status)}>{item.status}</span>
                        </td>
                        <td>{formatLastLoginAt(item.lastLoginAt)}</td>
                        <td>{formatAccountDateTime(item.createdAt)}</td>
                        <td>
                          <div className="d-flex gap-2">
                            <Link
                              to={`/admin/accounts/${item.userId}`}
                              className="btn btn-light btn-sm"
                              title="View"
                            >
                              <IconifyIcon icon="solar:eye-broken" className="align-middle fs-18" />
                            </Link>
                            {showLock ? (
                              <button
                                type="button"
                                className="btn btn-soft-danger btn-sm"
                                disabled={busy || mutating}
                                onClick={() => setLockTarget(item)}
                                title="Lock"
                              >
                                <IconifyIcon
                                  icon="solar:lock-keyhole-broken"
                                  className="align-middle fs-18"
                                />
                              </button>
                            ) : null}
                            {showUnlock ? (
                              <button
                                type="button"
                                className="btn btn-soft-success btn-sm"
                                disabled={busy || mutating}
                                onClick={() => void handleUnlock(item)}
                                title="Unlock"
                              >
                                <IconifyIcon
                                  icon="solar:lock-unlocked-broken"
                                  className="align-middle fs-18"
                                />
                              </button>
                            ) : null}
                          </div>
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
        open={lockTarget != null}
        title="Lock account"
        confirmLabel="Lock account"
        confirmVariant="danger"
        confirming={busyId != null && lockTarget?.userId === busyId}
        onCancel={() => {
          if (busyId) return;
          setLockTarget(null);
        }}
        onConfirm={() => void confirmLock()}
      >
        <p className="mb-2">
          Lock account <strong>{lockTarget?.fullName}</strong> ({lockTarget?.email})?
        </p>
        <p className="text-muted mb-0">The user will not be able to sign in until unlocked.</p>
      </AdminConfirmModal>
    </>
  );
}
