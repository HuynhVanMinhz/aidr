import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconifyIcon } from '../admin/IconifyIcon';
import { getRestockAdvice, requireRestockAdvice } from '../../services/restockAdviceApi';
import type { RestockAdviceItem } from '../../types/v2Features';

type Props = {
  days?: number;
};

export function RestockAdviceCard({ days = 14 }: Props) {
  const [items, setItems] = useState<RestockAdviceItem[]>([]);
  const [windowDays, setWindowDays] = useState(days);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getRestockAdvice(days)
      .then((result) => {
        if (cancelled) return;
        const advice = requireRestockAdvice(result);
        setItems(advice.items);
        setWindowDays(advice.salesWindowDays);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load restock advice.');
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) {
    return (
      <div className="card mb-3">
        <div className="card-body">
          <p className="text-muted mb-0">Loading restock advice…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-warning mb-3" role="alert">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card mb-3">
        <div className="card-body d-flex align-items-center gap-2">
          <IconifyIcon icon="solar:box-minimalistic-bold-duotone" className="fs-24 text-success" />
          <p className="mb-0 text-muted">
            No restock suggestions right now — stock levels look healthy for the last {windowDays} days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-3 seller-restock-card">
      <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h4 className="card-title mb-1">Restock advice</h4>
          <p className="text-muted mb-0 fs-13">
            Based on sales over the last {windowDays} days
          </p>
        </div>
        <Link to="/seller/inventory?lowStock=1" className="btn btn-sm btn-light">
          View low stock
        </Link>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover table-centered mb-0">
            <thead className="bg-light-subtle">
              <tr>
                <th>Product</th>
                <th>On hand</th>
                <th>Avg daily sales</th>
                <th>Days left</th>
                <th>Suggested qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId}>
                  <td>
                    <Link to={`/seller/products/${item.productId}/inventory`} className="fw-medium">
                      {item.name}
                    </Link>
                    <p className="text-muted mb-0 fs-12">{item.note}</p>
                  </td>
                  <td>
                    {item.availableQuantity}
                    <span className="text-muted fs-12"> / threshold {item.lowStockThreshold}</span>
                  </td>
                  <td>{item.avgDailySales.toFixed(2)}</td>
                  <td>
                    {item.daysUntilStockout != null ? item.daysUntilStockout.toFixed(1) : '—'}
                  </td>
                  <td>
                    <span className="badge bg-warning-subtle text-warning fw-medium">
                      +{item.suggestedQty}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
