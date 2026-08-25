import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useAuth } from '../../hooks/useAuth';
import { useAdminAccountDetail } from '../../hooks/useAdminGovernance';
import { useToast } from '../../hooks/useToast';
import {
  accountStatusBadgeClass,
  canLockAccount,
  canUnlockAccount,
  formatAccountDateTime,
  formatAccountRole,
  formatLastLoginAt,
  formatLockoutUntil,
  formatOptionalText,
} from '../../utils/adminGovernanceUi';

export function AdminAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { user } = useAuth();
  const { account, loading, mutating, error, lock, unlock } = useAdminAccountDetail(id);
  const [lockOpen, setLockOpen] = useState(false);

  async function confirmLock() {
    if (!account) return;
    try {
      await lock();
      toast.success('Account locked.');
      setLockOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to lock account.');
    }
  }

  async function handleUnlock() {
    try {
      await unlock();
      toast.success('Account unlocked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to unlock account.');
    }
  }

  if (loading && !account) {
    return <p className="text-muted">Loading account…</p>;
  }

  if (error && !account) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
          <Link to="/admin/accounts" className="btn btn-light">
            Back to accounts
          </Link>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-muted mb-3">Account not found.</p>
          <Link to="/admin/accounts" className="btn btn-light">
            Back to accounts
          </Link>
        </div>
      </div>
    );
  }

  const showLock = canLockAccount({
    accountUserId: account.userId,
    currentUserId: user?.userId,
    status: account.status,
    roles: account.roles,
  });
  const showUnlock = canUnlockAccount(account.status);

  return (
    <>
      <div className="row">
        <div className="col-xl-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-3">
                <span className="avatar-md rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fs-24">
                  {account.fullName.charAt(0).toUpperCase()}
                </span>
                <div>
                  <h4 className="card-title mb-1">{account.fullName}</h4>
                  <p className="text-muted mb-0">{account.email}</p>
                </div>
              </div>
              <span className={accountStatusBadgeClass(account.status)}>{account.status}</span>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <p className="text-muted mb-1">Phone</p>
                  <p className="mb-0 fw-medium">{formatOptionalText(account.phone)}</p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Email confirmed</p>
                  <p className="mb-0 fw-medium">{account.emailConfirmed ? 'Yes' : 'No'}</p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Roles</p>
                  <div className="d-flex flex-wrap gap-1">
                    {account.roles.length === 0 ? (
                      <span className="text-muted">No roles assigned</span>
                    ) : (
                      account.roles.map((r) => (
                        <span key={r} className="badge bg-light text-dark">
                          {formatAccountRole(r)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Last login</p>
                  <p className="mb-0 fw-medium">{formatLastLoginAt(account.lastLoginAt)}</p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Temporary lockout until</p>
                  <p className="mb-0 fw-medium">{formatLockoutUntil(account.lockoutUntil)}</p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Created</p>
                  <p className="mb-0 fw-medium">{formatAccountDateTime(account.createdAt)}</p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Updated</p>
                  <p className="mb-0 fw-medium">{formatAccountDateTime(account.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4">
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Actions</h4>
            </div>
            <div className="card-body d-grid gap-2">
              {showLock ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={mutating}
                  onClick={() => setLockOpen(true)}
                >
                  <IconifyIcon icon="solar:lock-keyhole-bold-duotone" className="align-middle me-1" />
                  Lock account
                </button>
              ) : null}
              {showUnlock ? (
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={mutating}
                  onClick={() => void handleUnlock()}
                >
                  <IconifyIcon
                    icon="solar:lock-unlocked-bold-duotone"
                    className="align-middle me-1"
                  />
                  Unlock account
                </button>
              ) : null}
              {!showLock && !showUnlock ? (
                <p className="text-muted mb-0">
                  No lock/unlock actions are available for this account.
                </p>
              ) : null}
              <Link to="/admin/accounts" className="btn btn-light">
                Back to list
              </Link>
            </div>
          </div>
        </div>
      </div>

      <AdminConfirmModal
        open={lockOpen}
        title="Lock account"
        confirmLabel="Lock account"
        confirmVariant="danger"
        confirming={mutating}
        onCancel={() => {
          if (mutating) return;
          setLockOpen(false);
        }}
        onConfirm={() => void confirmLock()}
      >
        <p className="mb-2">
          Lock account <strong>{account.fullName}</strong> ({account.email})?
        </p>
        <p className="text-muted mb-0">The user will not be able to sign in until unlocked.</p>
      </AdminConfirmModal>
    </>
  );
}
