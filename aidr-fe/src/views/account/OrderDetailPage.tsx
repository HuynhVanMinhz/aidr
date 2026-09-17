import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { reorderOrder, requireReorderResult } from '../../services/reorderApi';
import { BuyerProtectionTimelineCard } from '../../components/account/BuyerProtectionTimelineCard';
import { VideoDropzone } from '../../components/account/VideoDropzone';
import { OrderInvoice } from '../../components/checkout/OrderInvoice';
import { OrderReviewSection } from '../../components/reviews/OrderReviewSection';
import { OrderTrackingMap } from '../../components/shipping/OrderTrackingMap';
import { useBuyerOrderDetail } from '../../hooks/useBuyerOrders';
import { useBuyerOrderReturn } from '../../hooks/useBuyerOrderReturn';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from '../../utils/catalogImage';
import {
  isCloudinaryConfigured,
  uploadReturnVideoToCloudinary,
  validateReturnVideoFile,
} from '../../utils/cloudinaryUpload';
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
  validateResolutionType,
  validateReturnDescription,
  validateReturnReason,
  type BuyerReturnFormValues,
} from '../../utils/returnValidation';

const MAX_CANCEL_REASON = 300;

const emptyReturnForm: BuyerReturnFormValues = {
  reason: '',
  description: '',
  resolutionType: 'ReturnRefund',
  unboxingUrl: '',
  testingUrl: '',
};

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
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
  const [videoUploadError, setVideoUploadError] = useState<{
    unboxingUrl?: string;
    testingUrl?: string;
  }>({});
  const [reordering, setReordering] = useState(false);

  const uploadsEnabled = isCloudinaryConfigured();

  useEffect(() => {
    setShowReturnForm(false);
    setReturnForm(emptyReturnForm);
    setReturnDirty(false);
    setReturnTouched({});
    setReturnSubmitted(false);
    setVideoUploadError({});
  }, [orderId]);

  const returnErrors = useMemo(
    () => ({
      reason: tryValidateField(() => {
        validateReturnReason(returnForm.reason);
      }),
      description: tryValidateField(() => {
        validateReturnDescription(returnForm.description);
      }),
      resolutionType: tryValidateField(() => {
        validateResolutionType(returnForm.resolutionType);
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
    if (key === 'unboxingUrl' || key === 'testingUrl') {
      setVideoUploadError((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function pickReturnVideo(key: 'unboxingUrl' | 'testingUrl', url: string) {
    patchReturnField(key, url);
    setReturnTouched((prev) => ({ ...prev, [key]: true }));
    toast.success(key === 'unboxingUrl' ? 'Unboxing video uploaded.' : 'Testing video uploaded.');
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
      resolutionType: true,
      unboxingUrl: true,
      testingUrl: true,
    });

    if (
      returnErrors.reason ||
      returnErrors.description ||
      returnErrors.resolutionType ||
      returnErrors.unboxingUrl ||
      returnErrors.testingUrl
    ) {
      return;
    }

    try {
      await submitReturn({
        reason: returnForm.reason.trim(),
        description: returnForm.description.trim() || null,
        resolutionType: returnForm.resolutionType,
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
      setVideoUploadError({});
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to submit return request.';
      toast.error(message);
    }
  }

  async function handleReorder() {
    if (!orderId) return;
    setReordering(true);
    try {
      const result = requireReorderResult(await reorderOrder(orderId));
      if (result.skippedItems.length > 0) {
        const skippedNames = result.skippedItems.map((item) => item.productName).join(', ');
        toast.success(
          `${result.addedCount} item${result.addedCount === 1 ? '' : 's'} added to cart. Some items were skipped: ${skippedNames}.`,
        );
      } else {
        toast.success(
          `${result.addedCount} item${result.addedCount === 1 ? '' : 's'} added to cart.`,
        );
      }
      navigate('/cart');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to reorder items.');
    } finally {
      setReordering(false);
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
  const busy = mutating || returnMutating || reordering;
  const canReorder =
    detail.status !== 'PendingPayment' &&
    detail.status !== 'Cancelled' &&
    detail.items.length > 0;

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

      {detail.paidAt || (!unpaid && detail.status !== 'Cancelled') ? (
        <OrderInvoice
          orderCode={detail.orderCode}
          shopName={detail.shopName}
          currency={detail.currency}
          createdAt={detail.createdAt}
          paidAt={detail.paidAt}
          subtotalAmount={detail.subtotalAmount}
          discountAmount={detail.discountAmount}
          shippingFee={detail.shippingFee}
          totalAmount={detail.totalAmount}
          shipping={detail.shipping}
          buyerNote={detail.buyerNote}
          items={detail.items.map((item) => ({
            key: item.orderItemId,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          }))}
        />
      ) : null}

      {orderId ? <BuyerProtectionTimelineCard orderId={orderId} /> : null}

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
                      {item.variantName ? <span>{item.variantName}</span> : null}
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
        {canReorder ? (
          <button
            type="button"
            className="account-btn account-btn--primary"
            disabled={busy}
            onClick={() => void handleReorder()}
          >
            {reordering ? 'Adding to cart…' : 'Buy again'}
          </button>
        ) : null}

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
        <form
          className="account-card order-return-form"
          onSubmit={(event) => void handleCancel(event)}
          noValidate
        >
          <header className="order-return-form__head">
            <p className="order-return-form__eyebrow">Cancellation</p>
            <h3 className="order-card__title">Cancel order</h3>
            <p className="account-muted order-return-form__lead">
              Only unpaid orders can be cancelled. Reserved stock will be released.
            </p>
          </header>

          <div className="order-return-form__fields">
            <div className="form-group">
              <label htmlFor="cancel-reason">
                Reason <span className="order-review__optional">Optional</span>
              </label>
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
          </div>

          <div className="order-return-form__actions">
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
        <form
          className="account-card order-return-form"
          onSubmit={(event) => void handleSubmitReturn(event)}
          noValidate
        >
          <header className="order-return-form__head">
            <p className="order-return-form__eyebrow">Return &amp; refund</p>
            <h3 className="order-card__title">Request return / refund</h3>
            <p className="account-muted order-return-form__lead">
              Return and refund only — exchanges are not available. Upload Unboxing and Testing
              evidence videos (or paste Cloudinary URLs).
            </p>
          </header>

          <div className="order-return-form__hint" role="note">
            <i className="fa-solid fa-circle-info" aria-hidden />
            <p>
              Film the package from six sides plus the shipping label (Unboxing), then show the
              device powering on or the defect (Testing).
            </p>
          </div>

          <section className="order-return-form__section">
            <div className="order-review__step">
              <span className="order-review__step-badge" aria-hidden>
                1
              </span>
              <div className="order-review__step-copy">
                <h4 className="order-review__step-title">Describe the issue</h4>
                <p className="account-muted">What went wrong with this order?</p>
              </div>
            </div>

            <div className="order-return-form__fields">
              <div className="form-group">
                <span className="d-block" id="return-resolution-label">
                  Resolution *
                </span>
                <div
                  className="order-return-resolution"
                  role="radiogroup"
                  aria-labelledby="return-resolution-label"
                >
                  <label
                    className={`order-return-resolution__option${
                      returnForm.resolutionType === 'ReturnRefund'
                        ? ' order-return-resolution__option--active'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="return-resolution"
                      value="ReturnRefund"
                      checked={returnForm.resolutionType === 'ReturnRefund'}
                      onChange={() => patchReturnField('resolutionType', 'ReturnRefund')}
                      onBlur={() =>
                        setReturnTouched((prev) => ({ ...prev, resolutionType: true }))
                      }
                    />
                    <span className="order-return-resolution__title">Return &amp; refund</span>
                    <span className="order-return-resolution__hint">
                      Send the item back and get a full refund
                    </span>
                  </label>
                  <label
                    className={`order-return-resolution__option${
                      returnForm.resolutionType === 'Exchange'
                        ? ' order-return-resolution__option--active'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="return-resolution"
                      value="Exchange"
                      checked={returnForm.resolutionType === 'Exchange'}
                      onChange={() => patchReturnField('resolutionType', 'Exchange')}
                      onBlur={() =>
                        setReturnTouched((prev) => ({ ...prev, resolutionType: true }))
                      }
                    />
                    <span className="order-return-resolution__title">Exchange</span>
                    <span className="order-return-resolution__hint">
                      Send the item back and receive a replacement
                    </span>
                  </label>
                </div>
                {visibleReturnErrors.resolutionType ? (
                  <p className="form-field-error">{visibleReturnErrors.resolutionType}</p>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="return-reason">Reason *</label>
                <input
                  id="return-reason"
                  className="form-control"
                  value={returnForm.reason}
                  maxLength={500}
                  onBlur={() => setReturnTouched((prev) => ({ ...prev, reason: true }))}
                  onChange={(event) => patchReturnField('reason', event.target.value)}
                  placeholder="e.g. Screen cracked on arrival"
                />
                {visibleReturnErrors.reason ? (
                  <p className="form-field-error">{visibleReturnErrors.reason}</p>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="return-description">
                  Description <span className="order-review__optional">Optional</span>
                </label>
                <textarea
                  id="return-description"
                  className="form-control"
                  rows={3}
                  maxLength={2000}
                  value={returnForm.description}
                  onBlur={() => setReturnTouched((prev) => ({ ...prev, description: true }))}
                  onChange={(event) => patchReturnField('description', event.target.value)}
                  placeholder="Additional details that help us review faster"
                />
                {visibleReturnErrors.description ? (
                  <p className="form-field-error">{visibleReturnErrors.description}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="order-return-form__section">
            <div className="order-review__step">
              <span className="order-review__step-badge" aria-hidden>
                2
              </span>
              <div className="order-review__step-copy">
                <h4 className="order-review__step-title">Evidence videos</h4>
                <p className="account-muted">
                  {uploadsEnabled
                    ? 'Drop or browse a video for each slot — or paste a Cloudinary URL below.'
                    : 'Paste Cloudinary video URLs for both required clips.'}
                </p>
              </div>
            </div>

            <div className="order-return-form__evidence">
              <div className="order-return-evidence">
                <div className="order-return-evidence__body order-return-evidence__body--full">
                  <label htmlFor="return-unboxing-file">Unboxing video *</label>
                  <p className="order-return-evidence__hint">
                    Six sides of the package and the shipping label.
                  </p>
                  <VideoDropzone
                    id="return-unboxing-file"
                    value={returnForm.unboxingUrl}
                    onChange={(url) => pickReturnVideo('unboxingUrl', url)}
                    upload={uploadReturnVideoToCloudinary}
                    validate={validateReturnVideoFile}
                    disabled={busy || !uploadsEnabled}
                    emptyLabel={uploadsEnabled ? 'Drop unboxing video here' : 'Uploads unavailable'}
                    hint={
                      uploadsEnabled
                        ? 'MP4, WebM or MOV · up to 50MB'
                        : 'Video hosting is not configured — paste a URL below instead.'
                    }
                    onError={(message) =>
                      setVideoUploadError((prev) => ({ ...prev, unboxingUrl: message }))
                    }
                  />
                  <input
                    id="return-unboxing"
                    className="form-control form-control-sm order-return-evidence__url"
                    value={returnForm.unboxingUrl}
                    maxLength={512}
                    onBlur={() => setReturnTouched((prev) => ({ ...prev, unboxingUrl: true }))}
                    onChange={(event) => patchReturnField('unboxingUrl', event.target.value)}
                    placeholder="…or paste a video URL"
                    aria-label="Unboxing video URL"
                  />
                  {videoUploadError.unboxingUrl ? (
                    <p className="form-field-error">{videoUploadError.unboxingUrl}</p>
                  ) : null}
                  {visibleReturnErrors.unboxingUrl ? (
                    <p className="form-field-error">{visibleReturnErrors.unboxingUrl}</p>
                  ) : null}
                </div>
              </div>

              <div className="order-return-evidence">
                <div className="order-return-evidence__body order-return-evidence__body--full">
                  <label htmlFor="return-testing-file">Testing video *</label>
                  <p className="order-return-evidence__hint">
                    Device power-on or clear proof of the defect.
                  </p>
                  <VideoDropzone
                    id="return-testing-file"
                    value={returnForm.testingUrl}
                    onChange={(url) => pickReturnVideo('testingUrl', url)}
                    upload={uploadReturnVideoToCloudinary}
                    validate={validateReturnVideoFile}
                    disabled={busy || !uploadsEnabled}
                    emptyLabel={uploadsEnabled ? 'Drop testing video here' : 'Uploads unavailable'}
                    hint={
                      uploadsEnabled
                        ? 'MP4, WebM or MOV · up to 50MB'
                        : 'Video hosting is not configured — paste a URL below instead.'
                    }
                    onError={(message) =>
                      setVideoUploadError((prev) => ({ ...prev, testingUrl: message }))
                    }
                  />
                  <input
                    id="return-testing"
                    className="form-control form-control-sm order-return-evidence__url"
                    value={returnForm.testingUrl}
                    maxLength={512}
                    onBlur={() => setReturnTouched((prev) => ({ ...prev, testingUrl: true }))}
                    onChange={(event) => patchReturnField('testingUrl', event.target.value)}
                    placeholder="…or paste a video URL"
                    aria-label="Testing video URL"
                  />
                  {videoUploadError.testingUrl ? (
                    <p className="form-field-error">{videoUploadError.testingUrl}</p>
                  ) : null}
                  {visibleReturnErrors.testingUrl ? (
                    <p className="form-field-error">{visibleReturnErrors.testingUrl}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <div className="order-return-form__actions">
            <button
              type="submit"
              className="account-btn account-btn--primary"
              disabled={!canSubmitReturn || busy}
            >
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
                setVideoUploadError({});
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
