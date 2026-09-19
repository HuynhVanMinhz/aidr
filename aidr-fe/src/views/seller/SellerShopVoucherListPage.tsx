import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useSellerShopVouchers } from '../../hooks/useSellerShopVouchers';
import { useToast } from '../../hooks/useToast';
import type { SellerShopVoucher } from '../../types/seller';
import { adminBadgeClass, categoryVisibilityBadgeClass } from '../../utils/adminBadge';
import { formatMoney } from '../../utils/formatCatalog';
import { parseUtcDate } from '../../utils/dateUtc';

const PAGE_SIZE = 10;

function formatDiscount(item: SellerShopVoucher) {
  if (item.discountType.toLowerCase() === 'percent') {
    const cap =
      item.maxDiscountAmount != null
        ? ` (max ${formatMoney(item.maxDiscountAmount, 'VND')})`
        : '';
    return `${item.discountValue}%${cap}`;
  }
  return formatMoney(item.discountValue, 'VND');
}

function formatDate(iso: string) {
  const d = parseUtcDate(iso);
  if (!d) return '-';
  return d.toLocaleString();
}

function isExpired(item: SellerShopVoucher) {
  const ends = parseUtcDate(item.endsAt);
  return ends != null && ends.getTime() < Date.now();
}

export function SellerShopVoucherListPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, statusFilter]);

  const isActive = statusFilter === 'all' ? null : statusFilter === 'active';

  const { items, loading, error, summary, totalCount, page: serverPage, setStatus, remove, reload } =
    useSellerShopVouchers({
      q: debouncedQ,
      isActive,
      page,
      pageSize: PAGE_SIZE,
    });

  useEffect(() => {
    if (serverPage !== page) setPage(serverPage);
  }, [serverPage, page]);

  async function handleToggle(item: SellerShopVoucher) {
    setActionError(null);
    setBusyId(item.voucherId);
    try {
      const nextActive = !item.isActive;
      await setStatus(item.voucherId, nextActive);
      await reload({ q: debouncedQ, isActive, page, pageSize: PAGE_SIZE });
      toast.success(nextActive ? 'Voucher activated.' : 'Voucher disabled.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update status.';
      setActionError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: SellerShopVoucher) {
    if (!item.canDelete) {
      toast.error('This voucher has been used. Disable it instead of deleting.');
      return;
    }
    const ok = window.confirm(
      `Delete voucher "${item.code}"? Unused vouchers can be deleted permanently.`,
    );
    if (!ok) return;
    setActionError(null);
    setBusyId(item.voucherId);
    try {
      await remove(item.voucherId);
      await reload({ q: debouncedQ, isActive, page, pageSize: PAGE_SIZE });
      toast.success('Voucher deleted.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete voucher.';
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
            title="Total Vouchers"
            value={summary.totalCount}
            unit="Shop"
            icon="solar:ticket-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Active"
            value={summary.activeCount}
            unit="Visible"
            icon="solar:check-circle-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Inactive"
            value={summary.inactiveCount}
            unit="Hidden"
            icon="solar:close-circle-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Expired"
            value={summary.expiredCount}
            unit="Ended"
            icon="solar:calendar-bold-duotone"
            tone="info"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">My Shop Vouchers</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search code / name..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 200, flex: '0 0 auto' }}
                />
                <div style={{ width: 140, flex: '0 0 auto' }}>
                  <AdminSelect
                    size="sm"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}
                    options={[
                      { value: 'all', label: 'All status' },
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                    ]}
                  />
                </div>
                <Link
                  to="/seller/vouchers/new"
                  className="btn btn-sm btn-primary text-nowrap"
                  style={{ flex: '0 0 auto' }}
                >
                  Add Voucher
                </Link>
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
                    <th>Voucher</th>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Min order</th>
                    <th>Usage</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Actions</th>
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
                        No shop vouchers yet.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((item) => (
                    <tr key={item.voucherId}>
                      <td>
                        <p className="text-dark fw-medium fs-15 mb-0">{item.name}</p>
                        <p className="text-muted mb-0 fs-12">
                          {item.discountType}
                          {isExpired(item) ? ' · Expired' : ''}
                        </p>
                      </td>
                      <td>
                        <span className={adminBadgeClass.solidLight}>{item.code}</span>
                      </td>
                      <td>{formatDiscount(item)}</td>
                      <td>{formatMoney(item.minOrderAmount, 'VND')}</td>
                      <td>
                        {item.usedCount}
                        {item.usageLimit != null ? ` / ${item.usageLimit}` : ' / ∞'}
                      </td>
                      <td>
                        <p className="mb-0 fs-13">{formatDate(item.startsAt)}</p>
                        <p className="mb-0 fs-13 text-muted">{formatDate(item.endsAt)}</p>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className={categoryVisibilityBadgeClass(item.isActive)}>
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <div className="form-check form-switch mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              checked={item.isActive}
                              disabled={busyId === item.voucherId}
                              onChange={() => void handleToggle(item)}
                              aria-label={item.isActive ? 'Disable voucher' : 'Activate voucher'}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            to={`/seller/vouchers/${item.voucherId}/edit`}
                            className="btn btn-soft-primary btn-sm"
                            title="Edit"
                          >
                            <IconifyIcon icon="solar:pen-2-broken" className="align-middle fs-18" />
                          </Link>
                          <button
                            type="button"
                            className="btn btn-soft-danger btn-sm"
                            title={item.canDelete ? 'Delete' : 'Used vouchers cannot be deleted'}
                            disabled={busyId === item.voucherId || !item.canDelete}
                            onClick={() => void handleDelete(item)}
                          >
                            <IconifyIcon
                              icon="solar:trash-bin-minimalistic-2-broken"
                              className="align-middle fs-18"
                            />
                          </button>
                        </div>
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
