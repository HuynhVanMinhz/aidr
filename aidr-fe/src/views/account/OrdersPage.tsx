import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../components/common/SelectField';
import { useBuyerOrders } from '../../hooks/useBuyerOrders';
import { useToastMessage } from '../../hooks/useToastMessage';
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from '../../utils/catalogImage';
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
  useToastMessage(error);

  const totalPages = list?.totalPages ?? 0;
  const totalCount = list?.totalCount ?? 0;
  const items = list?.items ?? [];

  function handleStatusChange(next: string) {
    setStatus(next);
    setPage(1);
  }

  return (
    <div className="account-page">
      <div className="account-toolbar">
        <SelectField
          label="Status"
          value={status}
          options={BUYER_ORDER_STATUS_FILTERS}
          onChange={handleStatusChange}
        />
        <div className="d-flex align-items-center gap-3">
          {totalCount > 0 ? (
            <p className="account-count">
              {totalCount} order{totalCount === 1 ? '' : 's'}
            </p>
          ) : null}
          <button
            type="button"
            className="account-btn account-btn--secondary account-btn--sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <i className="fa-solid fa-rotate-right" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <p className="account-muted">Loading orders…</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="account-empty">
          <p>You have no orders{status ? ` with status “${formatOrderStatus(status)}”` : ''} yet.</p>
          <Link to="/products" className="account-btn account-btn--primary">
            Browse products
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          {/*
            Cards, not a table: seven columns did not fit the account column and
            pushed the action off screen.
          */}
          <ul className="account-stack">
            {items.map((order, index) => (
              <li key={order.orderId}>
                <Link to={`/account/orders/${order.orderId}`} className="account-row">
                  <div className="account-row__lead">
                    <span className="account-row__thumb">
                      <img
                        src={resolveProductImageUrl(order.thumbnailUrl, index)}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallback === '1') return;
                          img.dataset.fallback = '1';
                          img.src = PRODUCT_IMAGE_PLACEHOLDER;
                        }}
                      />
                    </span>
                    <div className="account-row__main">
                      <p className="account-row__code">
                        {order.orderCode}
                        <span className={orderStatusClass(order.status)}>
                          {formatOrderStatus(order.status)}
                        </span>
                      </p>
                      <p className="account-row__meta">
                        <span>{formatOrderDate(order.createdAt)}</span>
                        <span>{order.shopName}</span>
                        <span>
                          {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="account-row__side">
                    <p className="account-row__amount">
                      {formatMoney(order.totalAmount, order.currency)}
                    </p>
                    <span className="account-row__cta">
                      View details
                      <i className="fa-solid fa-arrow-right" aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="account-pagination">
              <button
                type="button"
                className="account-btn account-btn--secondary account-btn--sm"
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
                className="account-btn account-btn--secondary account-btn--sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
