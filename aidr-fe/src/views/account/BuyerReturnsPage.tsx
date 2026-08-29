import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SelectField } from '../../components/common/SelectField';
import { useToastMessage } from '../../hooks/useToastMessage';
import { listBuyerReturns } from '../../services/returnApi';
import type { BuyerReturnRequest } from '../../types/return';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatMoney } from '../../utils/formatCatalog';
import { formatOrderDate } from '../../utils/orderUi';
import {
  buyerReturnStatusClass,
  formatReturnStatus,
  returnStatusIcon,
  RETURN_STATUS_FILTERS,
} from '../../utils/returnUi';

const PAGE_SIZE = 10;

export function BuyerReturnsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BuyerReturnRequest[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useToastMessage(error);

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
    <div className="account-page">
      <div className="account-toolbar">
        <SelectField
          label="Status"
          value={status}
          options={RETURN_STATUS_FILTERS}
          onChange={handleStatusChange}
        />
        {totalCount > 0 ? (
          <p className="account-count">
            {totalCount} request{totalCount === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      {loading && items.length === 0 ? (
        <p className="account-muted">Loading return requests…</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="account-empty">
          <p>
            You have no return requests
            {status ? ` with status “${formatReturnStatus(status)}”` : ''}.
          </p>
          <Link to="/account/orders" className="account-btn account-btn--primary">
            View orders
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          {/*
            Cards instead of a table: six columns did not fit the account column
            and pushed the Actions button off screen.
          */}
          <ul className="account-stack">
            {items.map((item) => {
              const refund =
                item.refundAmount ?? item.items.reduce((sum, l) => sum + l.lineTotal, 0);

              return (
                <li key={item.returnRequestId}>
                  <Link
                    to={`/account/returns/${item.returnRequestId}`}
                    className="account-row"
                  >
                    <div className="account-row__main">
                      <p className="account-row__code">
                        {item.orderCode}
                        <span className={`${buyerReturnStatusClass(item.status)} return-status-chip`}>
                          <i className={returnStatusIcon(item.status)} aria-hidden />
                          {formatReturnStatus(item.status)}
                        </span>
                      </p>
                      <p className="account-row__text">{item.reason}</p>
                      <p className="account-row__meta">
                        <span>{formatOrderDate(item.createdAt)}</span>
                        <span>
                          {item.items.length} item{item.items.length === 1 ? '' : 's'}
                        </span>
                      </p>
                    </div>
                    <div className="account-row__side">
                      <p className="account-row__amount">{formatMoney(refund, 'VND')}</p>
                      <span className="account-row__cta">
                        View details
                        <i className="fa-solid fa-arrow-right" aria-hidden />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
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
                Page {page} of {totalPages}
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
