import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBuyerReturns } from '../../services/returnApi';
import type { BuyerReturnRequest } from '../../types/return';
import { getApiErrorMessage } from '../../utils/apiError';
import { buyerReturnStatusClass, formatReturnStatus } from '../../utils/returnUi';

const PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Receiving', label: 'Receiving' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Rejected', label: 'Rejected' },
] as const;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function BuyerReturnsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BuyerReturnRequest[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listBuyerReturns({
      status: status || null,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          throw new Error(result.message || 'Unable to load return requests.');
        }
        setItems(result.data.items);
        setTotalPages(result.data.totalPages);
        setTotalCount(result.data.totalCount);
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
  }, [page, status]);

  function handleStatusChange(next: string) {
    setStatus(next);
    setPage(1);
  }

  return (
    <div className="account-order-detail-box">
      <div className="buyer-orders-toolbar">
        <div className="buyer-orders-filters">
          <label htmlFor="buyer-return-status">Status</label>
          <select
            id="buyer-return-status"
            className="form-control"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value || 'all'} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger buyer-orders-alert" role="alert">
          {error}
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="account-muted">Loading return requests…</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="buyer-orders-empty">
          <p>You have no return requests{status ? ` with status “${formatReturnStatus(status)}”` : ''}.</p>
          <Link to="/account/orders" className="btn-default">
            View orders
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
                  <th>Submitted</th>
                  <th>Reason</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.returnRequestId}>
                    <td className="account-order-table-no">{item.orderCode}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.reason}</td>
                    <td>{item.items.length}</td>
                    <td>
                      <span className={buyerReturnStatusClass(item.status)}>
                        {formatReturnStatus(item.status)}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/account/returns/${item.returnRequestId}`}
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
                Page {page} of {totalPages} ({totalCount} total)
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
    </div>
  );
}
