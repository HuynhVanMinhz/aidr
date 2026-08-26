import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBuyerReturnById, requireBuyerReturn } from '../../services/returnApi';
import type { BuyerReturnRequest } from '../../types/return';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatMoney } from '../../utils/formatCatalog';
import { buyerReturnStatusClass, formatReturnStatus } from '../../utils/returnUi';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function BuyerReturnDetailPage() {
  const { returnId } = useParams<{ returnId: string }>();
  const [item, setItem] = useState<BuyerReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!returnId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getBuyerReturnById(returnId)
      .then((result) => {
        if (cancelled) return;
        setItem(requireBuyerReturn(result));
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
  }, [returnId]);

  if (!returnId) {
    return (
      <div className="account-details-content-box">
        <div className="auth-alert auth-alert--error">
          Return request id is required.{' '}
          <Link to="/account/returns">Back to returns</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="account-details-content-box">
        <p className="account-muted">Loading return request…</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="account-details-content-box">
        <div className="auth-alert auth-alert--error">
          {error || 'Return request not found.'}{' '}
          <Link to="/account/returns">Back to returns</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="account-order-detail-box">
      <div className="buyer-order-detail-header">
        <div>
          <h2>{item.orderCode}</h2>
          <p className="account-muted mb-0">Submitted {formatDate(item.createdAt)}</p>
        </div>
        <span className={buyerReturnStatusClass(item.status)}>{formatReturnStatus(item.status)}</span>
      </div>

      <div className="buyer-order-detail-section">
        <h3>Return information</h3>
        <p>
          <strong>Reason:</strong> {item.reason}
        </p>
        {item.description ? (
          <p>
            <strong>Description:</strong> {item.description}
          </p>
        ) : null}
        {item.refundAmount != null ? (
          <p>
            <strong>Refund amount:</strong> {formatMoney(item.refundAmount, 'VND')}
          </p>
        ) : null}
        {item.adminNote ? (
          <div className="buyer-return-note">
            <strong>Admin note:</strong> {item.adminNote}
          </div>
        ) : null}
        <p className="mb-0">
          <Link to={`/account/orders/${item.orderId}`} className="btn-default btn-accent btn-border">
            View original order
          </Link>
        </p>
      </div>

      <div className="buyer-order-detail-section">
        <h3>Returned items</h3>
        <div className="account-order-table-box">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {item.items.map((line) => (
                <tr key={line.returnItemId}>
                  <td>{line.productName}</td>
                  <td>{line.quantity}</td>
                  <td>{formatMoney(line.unitPrice, 'VND')}</td>
                  <td>{formatMoney(line.lineTotal, 'VND')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {item.evidences.length > 0 ? (
        <div className="buyer-order-detail-section">
          <h3>Evidence</h3>
          <ul className="buyer-return-evidence-list">
            {item.evidences.map((evidence) => (
              <li key={evidence.evidenceId}>
                <span className="buyer-return-evidence-type">{evidence.evidenceType}</span>
                <a href={evidence.mediaUrl} target="_blank" rel="noreferrer">
                  View media
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {item.statusHistories.length > 0 ? (
        <div className="buyer-order-detail-section">
          <h3>Status history</h3>
          <ul className="buyer-return-history-list">
            {item.statusHistories.map((entry, index) => (
              <li key={`${entry.createdAt}-${index}`}>
                <strong>{formatReturnStatus(entry.toStatus)}</strong>
                {entry.fromStatus ? (
                  <span className="account-muted"> from {formatReturnStatus(entry.fromStatus)}</span>
                ) : null}
                <div className="account-muted">{formatDate(entry.createdAt)}</div>
                {entry.note ? <p className="mb-0">{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mb-0">
        <Link to="/account/returns" className="btn-default btn-accent btn-border">
          Back to returns
        </Link>
      </p>
    </div>
  );
}
