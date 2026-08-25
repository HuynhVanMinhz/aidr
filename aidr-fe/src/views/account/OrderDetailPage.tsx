import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { OrderReviewSection } from '../../components/reviews/OrderReviewSection';
import { useBuyerOrderDetail } from '../../hooks/useBuyerOrders';
import { useToast } from '../../hooks/useToast';
import { formatMoney } from '../../utils/formatCatalog';
import {
  formatOrderDate,
  formatOrderStatus,
  formatShippingLine,
  orderStatusClass,
} from '../../utils/orderUi';

const MAX_CANCEL_REASON = 300;

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const toast = useToast();
  const { detail, loading, error, mutating, cancel, confirmReceived, refresh } =
    useBuyerOrderDetail(orderId);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleCancel(event: FormEvent) {
    event.preventDefault();
    setActionError(null);

    const trimmed = cancelReason.trim();
    if (trimmed.length > MAX_CANCEL_REASON) {
      setCancelReasonError(`Reason must not exceed ${MAX_CANCEL_REASON} characters.`);
      return;
    }
    setCancelReasonError(null);

    try {
      await cancel(trimmed || null);
      toast.success('Order cancelled.');
      setShowCancelForm(false);
      setCancelReason('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to cancel order.';
      setActionError(message);
      toast.error(message);
    }
  }

  async function handleConfirmReceived() {
    setActionError(null);
    const confirmed = window.confirm(
      'Confirm that you have received this order? This will complete the order.',
    );
    if (!confirmed) return;

    try {
      await confirmReceived();
      toast.success('Order marked as completed.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to confirm order received.';
      setActionError(message);
      toast.error(message);
    }
  }

  if (!orderId) {
    return (
      <div className="view-order-content-box">
        <p className="account-muted">Order id is missing.</p>
        <Link to="/account/orders" className="btn-default">
          Back to orders
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="view-order-content-box">
        <p className="account-muted">Loading order…</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="view-order-content-box">
        <div className="alert alert-danger" role="alert">
          {error || 'Order not found.'}
        </div>
        <div className="buyer-order-detail-actions">
          <button
            type="button"
            className="btn-default btn-accent btn-border"
            onClick={() => void refresh()}
          >
            Retry
          </button>
          <Link to="/account/orders" className="btn-default">
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const shipping = detail.shipping;
  const payment = detail.payment;

  return (
    <div className="view-order-content-box">
      <div className="buyer-order-detail-header">
        <div>
          <h2 className="buyer-order-detail-title">{detail.orderCode}</h2>
          <p className="account-muted">
            Placed {formatOrderDate(detail.createdAt)} ·{' '}
            <Link to={`/shops/${detail.shopId}`}>{detail.shopName}</Link>
          </p>
        </div>
        <span className={orderStatusClass(detail.status)}>
          {formatOrderStatus(detail.status)}
        </span>
      </div>

      {actionError ? (
        <div className="alert alert-danger buyer-orders-alert" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="view-order-product-info-box">
        <div className="cart-item-header">
          <span className="product-header-tag">Product</span>
          <span className="quantity-header-tag">Quantity</span>
          <span className="subtotal-header-tag">Total</span>
        </div>

        {detail.items.map((item) => (
          <div className="cart-item" key={item.orderItemId}>
            <div className="cart-item-image-content">
              <div className="cart-item-image">
                <figure>
                  <img
                    src={item.imageUrl || '/theme/images/product-image-1.png'}
                    alt={item.productName}
                  />
                </figure>
              </div>
              <div className="cart-item-info-content">
                <div className="cart-item-title">
                  <p>
                    <Link to={`/products/${item.productId}`}>{item.productName}</Link>
                  </p>
                  {item.sku ? <span className="account-muted">SKU: {item.sku}</span> : null}
                </div>
              </div>
            </div>
            <div className="cart-item-quantity-total">
              <div className="cart-item-quantity">
                <p>{String(item.quantity).padStart(2, '0')}</p>
              </div>
              <div className="cart-item-subtotal">
                <p>{formatMoney(item.lineTotal, detail.currency)}</p>
              </div>
            </div>
          </div>
        ))}

        <ul className="view-order-product-info-list">
          <li>
            Subtotal: <span>{formatMoney(detail.subtotalAmount, detail.currency)}</span>
          </li>
          {detail.discountAmount > 0 ? (
            <li>
              Discount: <span>-{formatMoney(detail.discountAmount, detail.currency)}</span>
            </li>
          ) : null}
          <li>
            Shipping:{' '}
            <span>
              {detail.shippingFee > 0
                ? formatMoney(detail.shippingFee, detail.currency)
                : 'Free shipping'}
            </span>
          </li>
          <li>
            Total: <span>{formatMoney(detail.totalAmount, detail.currency)}</span>
          </li>
          {payment ? (
            <li>
              Payment: <span>{payment.provider} · {payment.status}</span>
            </li>
          ) : null}
          {detail.trackingCode ? (
            <li>
              Tracking: <span>{detail.trackingCode}</span>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="view-order-address-item-list">
        <div className="view-order-address-item">
          <h2>Shipping address</h2>
          <ul>
            <li>{shipping.receiverName}</li>
            <li>{formatShippingLine(shipping)}</li>
            <li>
              <a href={`tel:${shipping.phone}`}>{shipping.phone}</a>
            </li>
          </ul>
        </div>

        <div className="view-order-address-item">
          <h2>Order notes</h2>
          <ul>
            <li>{detail.buyerNote?.trim() || 'No buyer note.'}</li>
            {detail.sellerNote?.trim() ? <li>Seller: {detail.sellerNote}</li> : null}
          </ul>
        </div>
      </div>

      {detail.statusHistory.length > 0 ? (
        <div className="buyer-order-history">
          <h2>Status history</h2>
          <ul>
            {detail.statusHistory.map((entry, index) => (
              <li key={`${entry.toStatus}-${entry.createdAt}-${index}`}>
                <strong>{formatOrderStatus(entry.toStatus)}</strong>
                <span className="account-muted"> · {formatOrderDate(entry.createdAt)}</span>
                {entry.note ? <p>{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.status === 'Completed' ? (
        <OrderReviewSection
          orderId={detail.orderId}
          shopId={detail.shopId}
          shopName={detail.shopName}
          items={detail.items}
        />
      ) : null}

      <div className="buyer-order-detail-actions">
        {detail.canCancel && !showCancelForm ? (
          <button
            type="button"
            className="btn-default btn-accent btn-border"
            disabled={mutating}
            onClick={() => setShowCancelForm(true)}
          >
            Cancel order
          </button>
        ) : null}

        {detail.canConfirmReceived ? (
          <button
            type="button"
            className="btn-default"
            disabled={mutating}
            onClick={() => void handleConfirmReceived()}
          >
            {mutating ? 'Confirming…' : 'Confirm received'}
          </button>
        ) : null}

        {detail.status === 'PendingPayment' && payment?.checkoutUrl ? (
          <a
            href={payment.checkoutUrl}
            className="btn-default"
            target="_blank"
            rel="noreferrer"
          >
            Continue payment
          </a>
        ) : null}

        <Link to="/account/orders" className="btn-default btn-accent btn-border">
          Back to orders
        </Link>
      </div>

      {showCancelForm ? (
        <form className="buyer-order-cancel-form" onSubmit={(event) => void handleCancel(event)}>
          <h3>Cancel order</h3>
          <p className="account-muted">
            Only unpaid orders can be cancelled. Reserved stock will be released.
          </p>
          <div className="form-group">
            <label htmlFor="cancel-reason">Reason (optional)</label>
            <textarea
              id="cancel-reason"
              className="form-control"
              rows={3}
              maxLength={MAX_CANCEL_REASON}
              value={cancelReason}
              onChange={(event) => {
                setCancelReason(event.target.value);
                if (cancelReasonError) setCancelReasonError(null);
              }}
              placeholder="Tell us why you are cancelling"
            />
            {cancelReasonError ? (
              <p className="form-field-error">{cancelReasonError}</p>
            ) : null}
          </div>
          <div className="buyer-order-detail-actions">
            <button type="submit" className="btn-default" disabled={mutating}>
              {mutating ? 'Cancelling…' : 'Confirm cancel'}
            </button>
            <button
              type="button"
              className="btn-default btn-accent btn-border"
              disabled={mutating}
              onClick={() => {
                setShowCancelForm(false);
                setCancelReason('');
                setCancelReasonError(null);
              }}
            >
              Keep order
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
