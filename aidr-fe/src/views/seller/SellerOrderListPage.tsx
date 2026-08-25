import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useSellerOrders } from '../../hooks/useSellerOrders';
import { formatOrderDate, formatOrderStatus } from '../../utils/orderUi';
import { formatVnd } from '../../utils/sellerProductUi';
import {
  SELLER_ORDER_STATUS_FILTERS,
  sellerOrderStatusBadgeClass,
  sellerOrderUpdateActionLabel,
} from '../../utils/sellerOrderUi';

export function SellerOrderListPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { list, loading, error } = useSellerOrders({
    status: status || null,
    page,
    pageSize: 10,
  });

  const items = list?.items ?? [];
  const totalPages = Math.max(list?.totalPages ?? 1, 1);

  useEffect(() => {
    if (list && list.page !== page && list.totalPages > 0) {
      setPage(list.page);
    }
  }, [list, page]);

  return (
    <div className="row">
      <div className="col-xl-12">
        <div className="card">
          <div className="d-flex card-header justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h4 className="card-title mb-0">All Order List</h4>
            </div>
            <div className="d-flex align-items-center gap-2">
              <AdminSelect
                id="seller-order-status"
                size="sm"
                block={false}
                value={status}
                options={SELLER_ORDER_STATUS_FILTERS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                onChange={(next) => {
                  setStatus(next);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {error ? (
            <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
              {error}
            </div>
          ) : null}

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle">
                  <tr>
                    <th>Order ID</th>
                    <th>Created at</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Items</th>
                    <th>Tracking</th>
                    <th>Order Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        Loading orders…
                      </td>
                    </tr>
                  ) : null}
                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        No orders
                        {status ? ` with status “${formatOrderStatus(status)}”` : ''} yet.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((order) => (
                    <tr key={order.orderId}>
                      <td>
                        <Link
                          to={`/seller/orders/${order.orderId}`}
                          className="link-primary fw-medium"
                        >
                          {order.orderCode}
                        </Link>
                      </td>
                      <td>{formatOrderDate(order.createdAt)}</td>
                      <td>
                        <div className="fw-medium">{order.buyerName}</div>
                        {order.buyerPhone ? (
                          <p className="text-muted mb-0 fs-13">{order.buyerPhone}</p>
                        ) : null}
                      </td>
                      <td>{formatVnd(order.totalAmount)}</td>
                      <td>{order.itemCount}</td>
                      <td>{order.trackingCode || '—'}</td>
                      <td>
                        <span className={sellerOrderStatusBadgeClass(order.status)}>
                          {formatOrderStatus(order.status)}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            to={`/seller/orders/${order.orderId}`}
                            className="btn btn-light btn-sm"
                            title="View"
                          >
                            <IconifyIcon icon="solar:eye-broken" className="align-middle fs-18" />
                          </Link>
                          {order.canUpdateStatus ? (
                            <Link
                              to={`/seller/orders/${order.orderId}`}
                              className="btn btn-soft-primary btn-sm"
                              title={sellerOrderUpdateActionLabel(order.nextStatus)}
                            >
                              <IconifyIcon icon="solar:pen-2-broken" className="align-middle fs-18" />
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-footer border-top">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <p className="mb-0 text-muted">
                Page {list?.page ?? page} of {totalPages} · {list?.totalCount ?? 0} order
                {(list?.totalCount ?? 0) === 1 ? '' : 's'}
              </p>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
