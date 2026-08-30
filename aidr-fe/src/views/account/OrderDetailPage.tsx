import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { OrderReviewSection } from '../../components/reviews/OrderReviewSection';
import { OrderTrackingMap } from '../../components/shipping/OrderTrackingMap';
import { useBuyerOrderDetail } from '../../hooks/useBuyerOrders';
import { useBuyerOrderReturn } from '../../hooks/useBuyerOrderReturn';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from '../../utils/catalogImage';
import { formatMoney } from '../../utils/formatCatalog';
import { formatShipmentStatus } from '../../utils/shipmentUi';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';
import {
  formatOrderDate,
  formatOrderStatus,
  formatShippingLine,
  orderStatusClass,
} from '../../utils/orderUi';
import {
  buyerReturnStatusClass,
  formatReturnStatus,
  returnStatusIcon,
} from '../../utils/returnUi';
import { routeProgress } from '../../types/tracking';
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
  } = useBuyerOrderReturn(orderId);

  useToastMessage(error);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
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
      toast.error(message);
    }
  }

  async function handleConfirmReceived() {
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
        <div className="page-state">
          <p className="page-state__title">Order not available</p>
          <p className="page-state__text">
            This order could not be loaded. Try again, or pick it from your order list.
          </p>
        </div>
        <div className="order-detail__actions">
          <button
            type="button"
            className="account-btn account-btn--secondary"
            onClick={() => void refresh()}
          >
            Retry
          </button>
          <Link to="/account/orders" className="account-btn account-btn--primary">
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const shipping = detail.shipping;
  const payment = detail.payment;
  const tracking = detail.tracking ?? null;
  // Nothing to track before payment, and nothing left to track once it is cancelled.
  const showTracking =
    tracking !== null &&
    detail.status !== 'PendingPayment' &&
    detail.status !== 'Cancelled' &&
    (Boolean(tracking.shipmentStatus) ||
      Boolean(tracking.route.pickup) ||
      Boolean(tracking.route.destination));
  const trackingProgress = routeProgress(tracking?.shipmentStatus, detail.status);
  const trackingLabel = tracking?.shipmentStatus
    ? formatShipmentStatus(tracking.shipmentStatus)
    : formatOrderStatus(detail.status);
  const eligibleForReturn = canRequestReturn(detail.status) && !returnRequest;
  const busy = mutating || returnMutating;

  const unpaid = detail.status === 'PendingPayment';

  return (
    <div className="order-detail account-page">
      <header className="order-detail__head">
        <div>
          <p className="order-detail__eyebrow">Order</p>
          <h2 className="order-detail__code">{detail.orderCode}</h2>
          <p className="order-detail__meta">
            Placed {formatOrderDate(detail.createdAt)} on{' '}
            <Link to={`/shops/${detail.shopId}`}>{detail.shopName}</Link>
          </p>
        </div>
        <span className={orderStatusClass(detail.status)}>
          {formatOrderStatus(detail.status)}
        </span>
      </header>

      <div className="order-detail__grid">
        <div className="order-detail__main">
          <section className="account-card">
            <h3 className="order-card__title">
              Items
              <span className="order-card__count">
                {detail.items.length} {detail.items.length === 1 ? 'product' : 'products'}
              </span>
            </h3>
            <ul className="order-line-list">
              {detail.items.map((item, index) => (
                <li key={item.orderItemId} className="order-line">
                  <Link to={`/products/${item.productId}`} className="order-line__thumb">
                    <img
                      src={resolveProductImageUrl(item.imageUrl, index)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallback === '1') return;
                        img.dataset.fallback = '1';
                        img.src = PRODUCT_IMAGE_PLACEHOLDER;
                      }}
                    />
                  </Link>
                  <div className="order-line__info">
                    <Link to={`/products/${item.productId}`} className="order-line__name">
                      {item.productName}
                    </Link>
                    <p className="order-line__meta">
                      {item.sku ? <span>{item.sku}</span> : null}
                      <span>Qty {item.quantity}</span>
                      <span>{formatMoney(item.unitPrice, detail.currency)} each</span>
                    </p>
                  </div>
                  <p className="order-line__total">
                    {formatMoney(item.lineTotal, detail.currency)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {showTracking && tracking ? (
            <section className="account-card order-tracking">
              <h3 className="order-card__title">
                Delivery tracking
                <span className="order-tracking__carrier">{tracking.carrier}</span>
              </h3>

              <p className="order-tracking__state">
                {trackingLabel}
                {tracking.trackingCode ? (
                  <>
                    {' · '}
                    <span className="order-tracking__code">{tracking.trackingCode}</span>
                  </>
                ) : null}
              </p>

              <OrderTrackingMap
                route={tracking.route}
                progress={trackingProgress}
                parcelLabel={trackingLabel}
                emptyHint="No map yet — this order has no pinned pickup or delivery point. Pin the delivery point on the address in Shipping addresses and it will show here on your next order."
              />

              <p className="order-tracking__disclaimer">
                <i className="fa-regular fa-circle-question" aria-hidden />
                <span>
                  {tracking.carrier} reports delivery milestones, not the driver's live
                  position — the parcel is drawn along the route at the point its latest
                  status implies.
                </span>
              </p>

              <dl className="order-tracking__facts">
                {tracking.expectedDeliveryAt ? (
                  <div>
                    <dt>Expected</dt>
                    <dd>{formatOrderDate(tracking.expectedDeliveryAt)}</dd>
                  </div>
                ) : null}
                {tracking.lastUpdateAt ? (
                  <div>
                    <dt>Last update</dt>
                    <dd>{formatOrderDate(tracking.lastUpdateAt)}</dd>
                  </div>
                ) : null}
              </dl>

              {tracking.events.length > 0 ? (
                <ol className="order-tracking__timeline">
                  {tracking.events.map((event) => (
                    <li key={event.shipmentEventId}>
                      <p className="order-tracking__timeline-title">
                        {formatShipmentStatus(event.mappedStatus)}
                      </p>
                      <p className="order-tracking__timeline-meta">
                        {formatOrderDate(event.occurredAt)}
                        {event.description?.trim() ? ` · ${event.description}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ) : null}

          <section className="account-card">
            <h3 className="order-card__title">Shipping address</h3>
            <p className="order-fact__name">{shipping.receiverName}</p>
            <p className="order-fact__row">
              <i className="fa-solid fa-location-dot" aria-hidden />
              <span>{formatShippingLine(shipping)}</span>
            </p>
            <p className="order-fact__row">
              <i className="fa-solid fa-phone" aria-hidden />
              <a href={`tel:${shipping.phone}`}>{shipping.phone}</a>
            </p>
            {detail.buyerNote?.trim() ? (
              <p className="order-fact__row">
                <i className="fa-regular fa-note-sticky" aria-hidden />
                <span>{detail.buyerNote}</span>
              </p>
            ) : null}
            {detail.sellerNote?.trim() ? (
              <p className="order-note">
                <strong>Note from the shop:</strong> {detail.sellerNote}
              </p>
            ) : null}
          </section>

          {detail.status === 'Completed' && !returnRequest ? (
            <OrderReviewSection
              orderId={detail.orderId}
              shopId={detail.shopId}
              shopName={detail.shopName}
              items={detail.items}
              currency={detail.currency}
            />
          ) : null}
        </div>

        <aside className="order-detail__side">
          <section className="account-card order-summary">
            <h3 className="order-card__title">Payment summary</h3>
            <p className="order-total__row">
              <span>Subtotal</span>
              <span>{formatMoney(detail.subtotalAmount, detail.currency)}</span>
            </p>
            {detail.discountAmount > 0 ? (
              <p className="order-total__row order-total__row--discount">
                <span>Discount</span>
                <span>&minus;{formatMoney(detail.discountAmount, detail.currency)}</span>
              </p>
            ) : null}
            <p className="order-total__row">
              <span>Shipping</span>
              <span>
                {detail.shippingFee > 0
                  ? formatMoney(detail.shippingFee, detail.currency)
                  : 'Free'}
              </span>
            </p>
            <p className="order-total__grand">
              <span>Total</span>
              <span>{formatMoney(detail.totalAmount, detail.currency)}</span>
            </p>

            {payment ? (
              <p className="order-summary__payment">
                {payment.provider} &middot; {payment.status}
              </p>
            ) : null}

            {unpaid && payment?.checkoutUrl ? (
              <a
                href={payment.checkoutUrl}
                className="account-btn account-btn--primary order-summary__pay"
                target="_blank"
                rel="noreferrer"
              >
                Continue payment
              </a>
            ) : null}

            {detail.trackingCode ? (
              <p className="order-summary__tracking">
                <i className="fa-solid fa-truck-fast" aria-hidden />
                Tracking {detail.trackingCode}
              </p>
            ) : null}
          </section>

          {detail.statusHistory.length > 0 ? (
            <section className="account-card">
              <h3 className="order-card__title">Progress</h3>
              <ol className="order-timeline">
                {detail.statusHistory.map((entry, index) => (
                  <li
                    key={`${entry.toStatus}-${entry.createdAt}-${index}`}
                    className={`order-timeline__step${
                      index === detail.statusHistory.length - 1
                        ? ' order-timeline__step--current'
                        : ''
                    }`}
                  >
                    <span className="order-timeline__marker" aria-hidden />
                    <div>
                      <p className="order-timeline__title">
                        {formatOrderStatus(entry.toStatus)}
                      </p>
                      <p className="order-timeline__time">{formatOrderDate(entry.createdAt)}</p>
                      {entry.note ? (
                        <p className="order-timeline__note">{entry.note}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </aside>
      </div>

      {returnLoading && !returnRequest && !returnMissing ? (
        <p className="account-muted">Loading return request…</p>
      ) : null}

      {/* The return has its own page; here we only surface that one exists. */}
      {returnRequest ? (
        <section className="account-card order-return-banner">
          <div>
            <p className="order-return-banner__title">
              Return request
              <span className={`${buyerReturnStatusClass(returnRequest.status)} return-status-chip`}>
                <i className={returnStatusIcon(returnRequest.status)} aria-hidden />
                {formatReturnStatus(returnRequest.status)}
              </span>
            </p>
            <p className="order-return-banner__reason">{returnRequest.reason}</p>
            {returnRequest.refundAmount != null ? (
              <p className="order-return-banner__amount">
                Refund {formatMoney(returnRequest.refundAmount, detail.currency)}
              </p>
            ) : null}
          </div>
          <Link
            to={`/account/returns/${returnRequest.returnRequestId}`}
            className="account-btn account-btn--secondary account-btn--sm"
          >
            View return
          </Link>
        </section>
      ) : null}

      {/* Primary action first, destructive last, "back" as a quiet link. */}
      <div className="order-detail__actions">
        {detail.canConfirmReceived ? (
          <button
            type="button"
            className="account-btn account-btn--primary"
            disabled={busy}
            onClick={() => void handleConfirmReceived()}
          >
            {mutating ? 'Confirming…' : 'Confirm received'}
          </button>
        ) : null}

        {eligibleForReturn && !showReturnForm ? (
          <button
            type="button"
            className="account-btn account-btn--secondary"
            disabled={busy}
            onClick={() => setShowReturnForm(true)}
          >
            Request return / refund
          </button>
        ) : null}

        {detail.canCancel && !showCancelForm ? (
          <button
            type="button"
            className="account-btn account-btn--danger"
            disabled={busy}
            onClick={() => setShowCancelForm(true)}
          >
            Cancel order
          </button>
        ) : null}

        <Link to="/account/orders" className="account-btn account-btn--ghost">
          <i className="fa-solid fa-arrow-left" aria-hidden />
          Back to orders
        </Link>
      </div>

      {showCancelForm ? (
        <form className="account-card order-form" onSubmit={(event) => void handleCancel(event)}>
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
          <div className="order-detail__actions">
            <button type="submit" className="account-btn account-btn--danger" disabled={busy}>
              {mutating ? 'Cancelling…' : 'Confirm cancel'}
            </button>
            <button
              type="button"
              className="account-btn account-btn--ghost"
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
        <form className="account-card order-form" onSubmit={(event) => void handleSubmitReturn(event)}>
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

          <div className="order-detail__actions">
            <button type="submit" className="account-btn account-btn--primary" disabled={!canSubmitReturn || busy}>
              {returnMutating ? 'Submitting…' : 'Submit return request'}
            </button>
            <button
              type="button"
              className="account-btn account-btn--ghost"
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
