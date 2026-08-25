import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { OrderReviewSection } from '../../components/reviews/OrderReviewSection';
import { useBuyerOrderDetail } from '../../hooks/useBuyerOrders';
import { useBuyerOrderReturn } from '../../hooks/useBuyerOrderReturn';
import { useToast } from '../../hooks/useToast';
import { formatMoney } from '../../utils/formatCatalog';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';
import {
  formatOrderDate,
  formatOrderStatus,
  formatShippingLine,
  orderStatusClass,
} from '../../utils/orderUi';
import { buyerReturnStatusClass, formatReturnStatus } from '../../utils/returnUi';
import {
  canRequestReturn,
  canSubmitBuyerReturnForm,
  validateEvidenceMediaUrl,
  validateReturnDescription,
  validateReturnReason,
  type BuyerReturnFormValues,
} from '../../utils/returnValidation';

const MAX_CANCEL_REASON = 300;

const emptyReturnForm: BuyerReturnFormValues = {
  reason: '',
  description: '',
  unboxingUrl: '',
  testingUrl: '',
};

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const toast = useToast();
  const { detail, loading, error, mutating, cancel, confirmReceived, refresh } =
    useBuyerOrderDetail(orderId);
  const {
    returnRequest,
    missing: returnMissing,
    loading: returnLoading,
    mutating: returnMutating,
    submitReturn,
    refresh: refreshReturn,
  } = useBuyerOrderReturn(orderId);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnForm, setReturnForm] = useState<BuyerReturnFormValues>(emptyReturnForm);
  const [returnDirty, setReturnDirty] = useState(false);
  const [returnTouched, setReturnTouched] = useState<
    Partial<Record<keyof BuyerReturnFormValues, boolean>>
  >({});
  const [returnSubmitted, setReturnSubmitted] = useState(false);

  useEffect(() => {
    setShowReturnForm(false);
    setReturnForm(emptyReturnForm);
    setReturnDirty(false);
    setReturnTouched({});
    setReturnSubmitted(false);
  }, [orderId]);

  const returnErrors = useMemo(
    () => ({
      reason: tryValidateField(() => {
        validateReturnReason(returnForm.reason);
      }),
      description: tryValidateField(() => {
        validateReturnDescription(returnForm.description);
      }),
      unboxingUrl: tryValidateField(() => {
        validateEvidenceMediaUrl(returnForm.unboxingUrl, 'Unboxing video URL');
      }),
      testingUrl: tryValidateField(() => {
        validateEvidenceMediaUrl(returnForm.testingUrl, 'Testing video URL');
      }),
    }),
    [returnForm],
  );

  const visibleReturnErrors = visibleFieldErrors(returnErrors, returnTouched, returnSubmitted);
  const canSubmitReturn = canSubmitBuyerReturnForm(returnForm, returnDirty, returnErrors);

  function patchReturnField<K extends keyof BuyerReturnFormValues>(key: K, value: string) {
    setReturnForm((prev) => ({ ...prev, [key]: value }));
    setReturnDirty(true);
  }

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

  async function handleSubmitReturn(event: FormEvent) {
    event.preventDefault();
    setReturnSubmitted(true);
    setReturnTouched({
      reason: true,
      description: true,
      unboxingUrl: true,
      testingUrl: true,
    });
    setActionError(null);

    if (
      returnErrors.reason ||
      returnErrors.description ||
      returnErrors.unboxingUrl ||
      returnErrors.testingUrl
    ) {
      return;
    }

    try {
      await submitReturn({
        reason: returnForm.reason.trim(),
        description: returnForm.description.trim() || null,
        evidences: [
          { evidenceType: 'Unboxing', mediaUrl: returnForm.unboxingUrl.trim() },
          { evidenceType: 'Testing', mediaUrl: returnForm.testingUrl.trim() },
        ],
      });
      toast.success('Return request submitted.');
      setShowReturnForm(false);
      setReturnForm(emptyReturnForm);
      setReturnDirty(false);
      setReturnTouched({});
      setReturnSubmitted(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to submit return request.';
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
  const eligibleForReturn = canRequestReturn(detail.status) && !returnRequest;
  const busy = mutating || returnMutating;

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

      {returnLoading && !returnRequest && !returnMissing ? (
        <p className="account-muted">Loading return request…</p>
      ) : null}

      {returnRequest ? (
        <div className="buyer-order-history">
          <div className="buyer-order-detail-header" style={{ marginBottom: '0.75rem' }}>
            <h2>Return / refund</h2>
            <span className={buyerReturnStatusClass(returnRequest.status)}>
              {formatReturnStatus(returnRequest.status)}
            </span>
          </div>
          <p>
            <strong>Reason:</strong> {returnRequest.reason}
          </p>
          {returnRequest.description ? <p>{returnRequest.description}</p> : null}
          {returnRequest.adminNote ? (
            <p>
              <strong>Admin note:</strong> {returnRequest.adminNote}
            </p>
          ) : null}
          {returnRequest.refundAmount != null ? (
            <p>
              <strong>Refund amount:</strong>{' '}
              {formatMoney(returnRequest.refundAmount, detail.currency)}
            </p>
          ) : null}

          <h3>Evidence</h3>
          <ul>
            {returnRequest.evidences.map((evidence) => (
              <li key={evidence.evidenceId}>
                <strong>{evidence.evidenceType}</strong>:{' '}
                <a href={evidence.mediaUrl} target="_blank" rel="noreferrer">
                  Open video
                </a>
              </li>
            ))}
          </ul>

          {returnRequest.statusHistories.length > 0 ? (
            <>
              <h3>Return history</h3>
              <ul>
                {returnRequest.statusHistories.map((entry, index) => (
                  <li key={`${entry.toStatus}-${entry.createdAt}-${index}`}>
                    <strong>{formatReturnStatus(entry.toStatus)}</strong>
                    <span className="account-muted"> · {formatOrderDate(entry.createdAt)}</span>
                    {entry.note ? <p>{entry.note}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <button
            type="button"
            className="btn-default btn-accent btn-border"
            disabled={returnMutating}
            onClick={() => void refreshReturn()}
          >
            Refresh return
          </button>
        </div>
      ) : null}

      {detail.status === 'Completed' && !returnRequest ? (
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
            disabled={busy}
            onClick={() => setShowCancelForm(true)}
          >
            Cancel order
          </button>
        ) : null}

        {detail.canConfirmReceived ? (
          <button
            type="button"
            className="btn-default"
            disabled={busy}
            onClick={() => void handleConfirmReceived()}
          >
            {mutating ? 'Confirming…' : 'Confirm received'}
          </button>
        ) : null}

        {eligibleForReturn && !showReturnForm ? (
          <button
            type="button"
            className="btn-default"
            disabled={busy}
            onClick={() => setShowReturnForm(true)}
          >
            Request return / refund
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
            <button type="submit" className="btn-default" disabled={busy}>
              {mutating ? 'Cancelling…' : 'Confirm cancel'}
            </button>
            <button
              type="button"
              className="btn-default btn-accent btn-border"
              disabled={busy}
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

      {showReturnForm ? (
        <form className="buyer-order-cancel-form" onSubmit={(event) => void handleSubmitReturn(event)}>
          <h3>Request return / refund</h3>
          <p className="account-muted">
            Return and refund only (no exchange). Upload Cloudinary video URLs for Unboxing
            (six sides of the package + shipping label) and Testing (device power-on / defect proof).
          </p>

          <div className="form-group">
            <label htmlFor="return-reason">Reason</label>
            <input
              id="return-reason"
              className="form-control"
              value={returnForm.reason}
              maxLength={500}
              onBlur={() => setReturnTouched((prev) => ({ ...prev, reason: true }))}
              onChange={(event) => patchReturnField('reason', event.target.value)}
              placeholder="Describe the issue"
            />
            {visibleReturnErrors.reason ? (
              <p className="form-field-error">{visibleReturnErrors.reason}</p>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="return-description">Description (optional)</label>
            <textarea
              id="return-description"
              className="form-control"
              rows={3}
              maxLength={2000}
              value={returnForm.description}
              onBlur={() => setReturnTouched((prev) => ({ ...prev, description: true }))}
              onChange={(event) => patchReturnField('description', event.target.value)}
              placeholder="Additional details"
            />
            {visibleReturnErrors.description ? (
              <p className="form-field-error">{visibleReturnErrors.description}</p>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="return-unboxing">Unboxing video URL</label>
            <input
              id="return-unboxing"
              className="form-control"
              value={returnForm.unboxingUrl}
              maxLength={512}
              onBlur={() => setReturnTouched((prev) => ({ ...prev, unboxingUrl: true }))}
              onChange={(event) => patchReturnField('unboxingUrl', event.target.value)}
              placeholder="https://res.cloudinary.com/..."
            />
            {visibleReturnErrors.unboxingUrl ? (
              <p className="form-field-error">{visibleReturnErrors.unboxingUrl}</p>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="return-testing">Testing video URL</label>
            <input
              id="return-testing"
              className="form-control"
              value={returnForm.testingUrl}
              maxLength={512}
              onBlur={() => setReturnTouched((prev) => ({ ...prev, testingUrl: true }))}
              onChange={(event) => patchReturnField('testingUrl', event.target.value)}
              placeholder="https://res.cloudinary.com/..."
            />
            {visibleReturnErrors.testingUrl ? (
              <p className="form-field-error">{visibleReturnErrors.testingUrl}</p>
            ) : null}
          </div>

          <div className="buyer-order-detail-actions">
            <button type="submit" className="btn-default" disabled={!canSubmitReturn || busy}>
              {returnMutating ? 'Submitting…' : 'Submit return request'}
            </button>
            <button
              type="button"
              className="btn-default btn-accent btn-border"
              disabled={busy}
              onClick={() => {
                setShowReturnForm(false);
                setReturnForm(emptyReturnForm);
                setReturnDirty(false);
                setReturnTouched({});
                setReturnSubmitted(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
