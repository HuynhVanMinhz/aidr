import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBuyerOrders } from '../../hooks/useBuyerOrders';
import { formatMoney } from '../../utils/formatCatalog';
import {
  BUYER_ORDER_STATUS_FILTERS,
  formatOrderDate,
  formatOrderStatus,
  orderStatusClass,
} from '../../utils/orderUi';

const PAGE_SIZE = 10;

export function OrdersPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      status: status || null,
      page,
      pageSize: PAGE_SIZE,
    }),
    [page, status],
  );

  const { list, loading, error, refresh } = useBuyerOrders(query);

  const totalPages = list?.totalPages ?? 0;
  const items = list?.items ?? [];

  function handleStatusChange(next: string) {
    setStatus(next);
    setPage(1);
  }

  return (
    <div className="account-order-detail-box">
      <div className="buyer-orders-toolbar">
        <div className="buyer-orders-filters">
          <label htmlFor="buyer-order-status">Status</label>
          <select
            id="buyer-order-status"
            className="form-control"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
          >
            {BUYER_ORDER_STATUS_FILTERS.map((filter) => (
              <option key={filter.value || 'all'} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-default btn-accent btn-border"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="alert alert-danger buyer-orders-alert" role="alert">
          {error}
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="account-muted">Loading orders…</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="buyer-orders-empty">
          <p>You have no orders{status ? ` with status “${formatOrderStatus(status)}”` : ''} yet.</p>
          <Link to="/products" className="btn-default">
            Browse products
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="account-order-table-box">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Shop</th>
                  <th>Status</th>
                  <th>Quantity</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.orderId}>
                    <td className="account-order-table-no">
                      <div className="buyer-order-code-cell">
                        {order.thumbnailUrl ? (
                          <img src={order.thumbnailUrl} alt="" className="buyer-order-thumb" />
                        ) : null}
                        <span>{order.orderCode}</span>
                      </div>
                    </td>
                    <td>{formatOrderDate(order.createdAt)}</td>
                    <td>
                      <Link to={`/shops/${order.shopId}`}>{order.shopName}</Link>
                    </td>
                    <td>
                      <span className={orderStatusClass(order.status)}>
                        {formatOrderStatus(order.status)}
                      </span>
                    </td>
                    <td>
                      {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                    </td>
                    <td>{formatMoney(order.totalAmount, order.currency)}</td>
                    <td>
                      <Link
                        to={`/account/orders/${order.orderId}`}
                        className="btn-default btn-accent btn-border"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="buyer-orders-pagination">
              <button
                type="button"
                className="btn-default btn-accent btn-border"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span>
                Page {list?.page ?? page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-default btn-accent btn-border"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="account-order-button">
        <Link to="/products" className="btn-default">
          Back to Shop
        </Link>
      </div>
    </div>
  );
}
