import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { listAdminOrders } from '../../services/adminApi';
import type { AdminOrderListItem } from '../../types/adminOps';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatMoney } from '../../utils/formatCatalog';
import { BUYER_ORDER_STATUS_FILTERS, formatOrderDate, formatOrderStatus } from '../../utils/orderUi';
import { sellerOrderStatusBadgeClass } from '../../utils/sellerOrderUi';

const PAGE_SIZE = 10;

export function AdminOrderListPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminOrderListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listAdminOrders({
      status: status || null,
      q: debouncedQ || null,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          throw new Error(result.message || 'Unable to load orders.');
        }
        setItems(result.data.items);
        setTotalCount(result.data.totalCount);
        if (result.data.page !== page) setPage(result.data.page);
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
  }, [debouncedQ, page, status]);

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="In This View"
            value={totalCount}
            unit="Orders"
            icon="solar:bag-check-bold-duotone"
            tone="primary"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">Platform Orders</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <AdminSelect
                  id="admin-order-status"
                  size="sm"
                  block={false}
                  menuAlign="end"
                  value={status}
                  options={BUYER_ORDER_STATUS_FILTERS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={setStatus}
                />
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search order / buyer / shop..."
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
                    <th>Buyer</th>
                    <th>Shop</th>
                    <th>Created</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        Loading orders…
                      </td>
                    </tr>
                  ) : null}
                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        No orders found.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((order) => (
                    <tr key={order.orderId}>
                      <td>
                        <Link
                          to={`/admin/orders/${order.orderId}`}
                          className="fw-medium link-primary"
                        >
                          {order.orderCode}
                        </Link>
                      </td>
                      <td>
                        <div className="fw-medium">{order.buyerName}</div>
                        <div className="text-muted fs-12">{order.buyerEmail}</div>
                      </td>
                      <td>{order.shopName}</td>
                      <td>{formatOrderDate(order.createdAt)}</td>
                      <td>{formatMoney(order.totalAmount, order.currency)}</td>
                      <td>
                        <span className={sellerOrderStatusBadgeClass(order.status)}>
                          {formatOrderStatus(order.status)}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/admin/orders/${order.orderId}`}
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
