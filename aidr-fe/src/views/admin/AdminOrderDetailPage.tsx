import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAdminOrder } from '../../services/adminApi';
import type { AdminOrderDetail } from '../../types/adminOps';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatMoney } from '../../utils/formatCatalog';
import { formatOrderDate, formatOrderStatus } from '../../utils/orderUi';
import { formatVnd } from '../../utils/sellerProductUi';
import { sellerOrderStatusBadgeClass } from '../../utils/sellerOrderUi';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return formatOrderDate(value);
}

export function AdminOrderDetailPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAdminOrder(orderId)
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          throw new Error(result.message || 'Order not found.');
        }
        setDetail(result.data);
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
  }, [orderId]);

  if (!orderId) {
    return (
      <div className="alert alert-danger" role="alert">
        Order id is required.{' '}
        <Link to="/admin/orders" className="alert-link">
          Back to orders
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="text-muted">Loading order…</p>;
  }

  if (error || !detail) {
    return (
      <div className="alert alert-danger" role="alert">
        {error || 'Order not found.'}{' '}
        <Link to="/admin/orders" className="alert-link">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="row">
      <div className="col-xl-9 col-lg-8">
        <div className="card">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <h4 className="fw-medium text-dark d-flex align-items-center gap-2 flex-wrap">
                  {detail.orderCode}
                  <span className={sellerOrderStatusBadgeClass(detail.status)}>
                    {formatOrderStatus(detail.status)}
                  </span>
                </h4>
                <p className="mb-0 text-muted">
                  Created {formatDate(detail.createdAt)}
                  {detail.paidAt ? ` · Paid ${formatDate(detail.paidAt)}` : ''}
                </p>
              </div>
              <Link to="/admin/orders" className="btn btn-outline-light">
                Back to list
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h4 className="card-title mb-0">Order items</h4>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0 table-hover table-centered">
              <thead className="bg-light-subtle">
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.orderItemId}>
                    <td>{item.productName}</td>
                    <td>{item.sku || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatVnd(item.unitPrice)}</td>
                    <td>{formatVnd(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {detail.statusHistory.length > 0 ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-0">Status history</h4>
            </div>
            <div className="card-body">
              <ul className="list-unstyled mb-0">
                {detail.statusHistory.map((entry, index) => (
                  <li key={`${entry.createdAt}-${index}`} className="mb-3 pb-3 border-bottom">
                    <strong>{formatOrderStatus(entry.toStatus)}</strong>
                    {entry.fromStatus ? (
                      <span className="text-muted"> from {formatOrderStatus(entry.fromStatus)}</span>
                    ) : null}
                    <div className="text-muted fs-13">{formatDate(entry.createdAt)}</div>
                    {entry.note ? <p className="mb-0 mt-1">{entry.note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="col-xl-3 col-lg-4">
        <div className="card">
          <div className="card-header">
            <h4 className="card-title mb-0">Summary</h4>
          </div>
          <div className="card-body">
            <p className="mb-2">
              <strong>Buyer:</strong> {detail.buyerName}
            </p>
            <p className="mb-2">
              <strong>Email:</strong> {detail.buyerEmail}
            </p>
            {detail.buyerPhone ? (
              <p className="mb-2">
                <strong>Phone:</strong> {detail.buyerPhone}
              </p>
            ) : null}
            <p className="mb-2">
              <strong>Shop:</strong> {detail.shopName}
            </p>
            <hr />
            <p className="mb-1 d-flex justify-content-between">
              <span>Subtotal</span>
              <span>{formatMoney(detail.subtotalAmount, detail.currency)}</span>
            </p>
            <p className="mb-1 d-flex justify-content-between">
              <span>Discount</span>
              <span>{formatMoney(detail.discountAmount, detail.currency)}</span>
            </p>
            <p className="mb-1 d-flex justify-content-between">
              <span>Shipping</span>
              <span>{formatMoney(detail.shippingFee, detail.currency)}</span>
            </p>
            <p className="mb-0 d-flex justify-content-between fw-semibold">
              <span>Total</span>
              <span>{formatMoney(detail.totalAmount, detail.currency)}</span>
            </p>
            {detail.trackingCode ? (
              <>
                <hr />
                <p className="mb-0">
                  <strong>Tracking:</strong> {detail.trackingCode}
                </p>
              </>
            ) : null}
            {detail.buyerNote ? (
              <>
                <hr />
                <p className="mb-0">
                  <strong>Buyer note:</strong> {detail.buyerNote}
                </p>
              </>
            ) : null}
            {detail.sellerNote ? (
              <p className="mb-0 mt-2">
                <strong>Seller note:</strong> {detail.sellerNote}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
