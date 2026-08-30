import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FormField } from '../../components/admin/FormField';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { OrderTrackingMap } from '../../components/shipping/OrderTrackingMap';
import { useSellerOrderDetail } from '../../hooks/useSellerOrders';
import { useToast } from '../../hooks/useToast';
import { formatOrderDate, formatOrderStatus, formatShippingLine } from '../../utils/orderUi';
import { formatVnd } from '../../utils/sellerProductUi';
import {
  MAX_SELLER_NOTE_LENGTH,
  MAX_STATUS_NOTE_LENGTH,
  MAX_TRACKING_CODE_LENGTH,
  formatShipmentStatus,
  sellerOrderStatusBadgeClass,
  sellerOrderUpdateActionLabel,
  shipmentStatusBadgeClass,
} from '../../utils/sellerOrderUi';
import {
  canSubmitSellerOrderUpdate,
  validateSellerOrderUpdate,
  type SellerOrderUpdateFieldErrors,
  type SellerOrderUpdateFormValues,
} from '../../utils/sellerOrderValidation';
import { routeProgress } from '../../types/tracking';

const EMPTY_FORM: SellerOrderUpdateFormValues = {
  trackingCode: '',
  sellerNote: '',
  note: '',
};

export function SellerOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const toast = useToast();
  const { detail, loading, error, mutating, updateStatus } = useSellerOrderDetail(orderId);

  const [form, setForm] = useState<SellerOrderUpdateFormValues>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [visibleErrors, setVisibleErrors] = useState<SellerOrderUpdateFieldErrors>({});
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) return;
    setForm({
      trackingCode: detail.trackingCode ?? '',
      sellerNote: detail.sellerNote ?? '',
      note: '',
    });
    setDirty(
      detail.nextStatus === 'Confirmed' ||
        detail.nextStatus === 'Delivered' ||
        Boolean(detail.trackingCode?.trim()),
    );
    setVisibleErrors({});
    setActionError(null);
  }, [detail]);

  const fieldErrors = useMemo(() => {
    if (!detail?.nextStatus) return {};
    return validateSellerOrderUpdate(form, {
      nextStatus: detail.nextStatus,
      existingTrackingCode: detail.trackingCode,
    });
  }, [detail?.nextStatus, detail?.trackingCode, form]);

  const canSubmit =
    Boolean(detail?.canUpdateStatus && detail.nextStatus) &&
    canSubmitSellerOrderUpdate(form, {
      nextStatus: detail?.nextStatus ?? '',
      existingTrackingCode: detail?.trackingCode,
      dirty,
      errors: fieldErrors,
    });

  function updateField<K extends keyof SellerOrderUpdateFormValues>(
    key: K,
    value: SellerOrderUpdateFormValues[K],
  ) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
    setVisibleErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleUpdateStatus(e: FormEvent) {
    e.preventDefault();
    if (!detail?.nextStatus) return;

    const errors = validateSellerOrderUpdate(form, {
      nextStatus: detail.nextStatus,
      existingTrackingCode: detail.trackingCode,
    });
    setVisibleErrors(errors);
    setDirty(true);
    if (Object.keys(errors).length > 0) return;

    setActionError(null);
    try {
      await updateStatus({
        status: detail.nextStatus,
        trackingCode: form.trackingCode.trim() || null,
        sellerNote: form.sellerNote.trim() || null,
        note: form.note.trim() || null,
      });
      toast.success(`Order marked as ${formatOrderStatus(detail.nextStatus)}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update order status.';
      setActionError(message);
      toast.error(message);
    }
  }

  if (!orderId) {
    return (
      <div className="alert alert-danger" role="alert">
        Order id is required.{' '}
        <Link to="/seller/orders" className="alert-link">
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
        <Link to="/seller/orders" className="alert-link">
          Back to orders
        </Link>
      </div>
    );
  }

  const shippingLine = formatShippingLine(detail.shipping);
  const fulfillment = detail.fulfillment;
  const shipment = fulfillment?.shipment ?? null;
  const automated = Boolean(fulfillment?.autoEnabled && !fulfillment.requiresSellerAction);
  // A carrier-issued code is the shipment's identity — the seller must not retype it.
  const carrierTracking = shipment?.trackingCode?.trim() || null;
  const recentEvents = shipment?.events.slice(0, 4) ?? [];

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
                  Created {formatOrderDate(detail.createdAt)}
                  {detail.paidAt ? ` · Paid ${formatOrderDate(detail.paidAt)}` : ''}
                </p>
              </div>
              <Link to="/seller/orders" className="btn btn-outline-light">
                Back to list
              </Link>
            </div>

            <div className="mt-4">
              <h4 className="fw-medium text-dark">Fulfillment progress</h4>
            </div>
            <div className="row row-cols-xxl-5 row-cols-md-2 row-cols-1">
              {(
                [
                  { key: 'Paid', label: 'Paid' },
                  { key: 'Confirmed', label: 'Confirmed' },
                  { key: 'Shipping', label: 'Shipping' },
                  { key: 'Delivered', label: 'Delivered' },
                  { key: 'Completed', label: 'Completed' },
                ] as const
              ).map((step) => {
                const reached = isStepReached(detail.status, step.key);
                const active = detail.status === step.key;
                return (
                  <div className="col" key={step.key}>
                    <div className="progress mt-3" style={{ height: 10 }}>
                      <div
                        className={`progress-bar progress-bar-striped${reached ? ' progress-bar-animated' : ''} ${
                          reached ? (active ? 'bg-warning' : 'bg-success') : 'bg-primary'
                        }`}
                        role="progressbar"
                        style={{ width: reached ? '100%' : '0%' }}
                      />
                    </div>
                    <p className="mb-0 mt-2">{step.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Products</h4>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle border-bottom">
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Unit price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.orderItemId}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="rounded bg-light avatar-md d-flex align-items-center justify-content-center overflow-hidden">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="avatar-md" />
                            ) : (
                              <IconifyIcon
                                icon="solar:box-bold-duotone"
                                className="fs-24 text-muted"
                              />
                            )}
                          </div>
                          <span className="text-dark fw-medium fs-15">{item.productName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={!item.sku ? 'text-muted' : undefined}>
                          {item.sku?.trim() || 'No SKU'}
                        </span>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatVnd(item.unitPrice)}</td>
                      <td>{formatVnd(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {fulfillment ? (
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between gap-2">
              <h4 className="card-title mb-0">Delivery route</h4>
              <span className={shipmentStatusBadgeClass(shipment?.status)}>
                {shipment ? formatShipmentStatus(shipment.status) : 'No shipment yet'}
              </span>
            </div>
            <div className="card-body">
              <OrderTrackingMap
                route={fulfillment.route}
                progress={routeProgress(shipment?.status, detail.status)}
                parcelLabel={
                  shipment ? formatShipmentStatus(shipment.status) : formatOrderStatus(detail.status)
                }
                emptyHint="No map yet — pin this shop's pickup point in Shop settings; the buyer's address needs a pinned delivery point too."
                height={340}
              />
              <p className="mb-0 mt-3 text-muted fs-13">
                {fulfillment.provider} reports delivery milestones, not the driver's live
                position — the parcel is drawn along the route at the point its latest
                status implies.
              </p>
            </div>
          </div>
        ) : null}

        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Status history</h4>
          </div>
          <div className="card-body">
            {detail.statusHistory.length === 0 ? (
              <p className="text-muted mb-0">No status history yet.</p>
            ) : (
              <ul className="list-unstyled mb-0">
                {detail.statusHistory.map((entry, index) => (
                  <li
                    key={`${entry.toStatus}-${entry.createdAt}-${index}`}
                    className={index === detail.statusHistory.length - 1 ? 'mb-0' : 'mb-3'}
                  >
                    <p className="mb-1 fw-medium text-dark">
                      {entry.fromStatus
                        ? `${formatOrderStatus(entry.fromStatus)} → ${formatOrderStatus(entry.toStatus)}`
                        : formatOrderStatus(entry.toStatus)}
                    </p>
                    <p className="mb-0 text-muted fs-13">
                      {formatOrderDate(entry.createdAt)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="col-xl-3 col-lg-4">
        {fulfillment ? (
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between gap-2">
              <h4 className="card-title mb-0">Fulfillment</h4>
              <span
                className={
                  automated ? sellerOrderStatusBadgeClass('Paid') : sellerOrderStatusBadgeClass('PendingPayment')
                }
              >
                {automated ? `Auto · ${fulfillment.provider}` : 'Needs attention'}
              </span>
            </div>
            <div className="card-body">
              {fulfillment.stalledReason ? (
                <div className="alert alert-warning" role="alert">
                  {fulfillment.stalledReason}
                </div>
              ) : null}

              <p className="mb-2 text-muted">
                Carrier: <span className="text-dark fw-medium">{fulfillment.provider}</span>
              </p>

              {shipment ? (
                <>
                  <p className="mb-2 text-muted">
                    Shipment:{' '}
                    <span className={shipmentStatusBadgeClass(shipment.status)}>
                      {formatShipmentStatus(shipment.status)}
                    </span>
                  </p>
                  <p className="mb-2 text-muted">
                    Tracking:{' '}
                    <span className={shipment.trackingCode ? 'text-dark fw-medium' : 'text-muted'}>
                      {shipment.trackingCode?.trim() || 'Not issued yet'}
                    </span>
                  </p>
                  {shipment.expectedDeliveryAt ? (
                    <p className="mb-2 text-muted">
                      Expected: {formatOrderDate(shipment.expectedDeliveryAt)}
                    </p>
                  ) : null}
                  <p className="mb-0 text-muted fs-13">
                    Last update: {formatOrderDate(shipment.lastSyncedAt ?? shipment.updatedAt)}
                  </p>

                  {recentEvents.length > 0 ? (
                    <ul className="list-unstyled mb-0 mt-3">
                      {recentEvents.map((event) => (
                        <li key={event.shipmentEventId} className="mb-2">
                          <p className="mb-0 fw-medium text-dark fs-14">
                            {formatShipmentStatus(event.mappedStatus)}
                          </p>
                          <p className="mb-0 text-muted fs-13">
                            {formatOrderDate(event.occurredAt)}
                            {event.description ? ` · ${event.description}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="mb-0 text-muted">
                  {automated
                    ? `No shipment yet. ${fulfillment.provider} is booked automatically once the payment settles.`
                    : 'No shipment booked for this order.'}
                </p>
              )}

              {automated ? (
                <p className="mb-0 mt-3 text-muted fs-13">
                  {fulfillment.provider} updates this order automatically — you can still
                  move it forward yourself below if you need to.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {detail.canUpdateStatus && detail.nextStatus ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Update status</h4>
            </div>
            <div className="card-body">
              {(actionError) && (
                <div className="alert alert-danger" role="alert">
                  {actionError}
                </div>
              )}
              <p className="text-muted">
                Next step:{' '}
                <span className="text-dark fw-medium">
                  {formatOrderStatus(detail.nextStatus)}
                </span>
              </p>
              <form onSubmit={handleUpdateStatus} noValidate>
                <FormField
                  label="Tracking code"
                  htmlFor="seller-order-tracking"
                  error={visibleErrors.trackingCode}
                >
                  <input
                    id="seller-order-tracking"
                    type="text"
                    className="form-control"
                    value={form.trackingCode}
                    maxLength={MAX_TRACKING_CODE_LENGTH}
                    readOnly={Boolean(carrierTracking)}
                    placeholder={
                      carrierTracking
                        ? carrierTracking
                        : automated
                          ? `${fulfillment?.provider} will issue one`
                          : detail.nextStatus === 'Shipping'
                            ? 'Required for shipping'
                            : 'Optional'
                    }
                    onChange={(e) => updateField('trackingCode', e.target.value)}
                    onBlur={() => {
                      if (!dirty) return;
                      setVisibleErrors((prev) => ({
                        ...prev,
                        ...(fieldErrors.trackingCode
                          ? { trackingCode: fieldErrors.trackingCode }
                          : {}),
                      }));
                    }}
                  />
                </FormField>

                {carrierTracking ? (
                  <p className="text-muted fs-13 mt-n2 mb-3">
                    Issued by {shipment?.provider} — nothing to type here.
                  </p>
                ) : automated ? (
                  <p className="text-muted fs-13 mt-n2 mb-3">
                    {fulfillment?.provider} issues the tracking code when it books this
                    shipment. Only fill this in if you are shipping the order yourself.
                  </p>
                ) : null}

                <FormField
                  label="Seller note"
                  htmlFor="seller-order-seller-note"
                  error={visibleErrors.sellerNote}
                >
                  <textarea
                    id="seller-order-seller-note"
                    className="form-control"
                    rows={2}
                    value={form.sellerNote}
                    maxLength={MAX_SELLER_NOTE_LENGTH}
                    onChange={(e) => updateField('sellerNote', e.target.value)}
                    onBlur={() => {
                      if (!dirty) return;
                      setVisibleErrors((prev) => ({
                        ...prev,
                        ...(fieldErrors.sellerNote ? { sellerNote: fieldErrors.sellerNote } : {}),
                      }));
                    }}
                  />
                </FormField>

                <FormField
                  label="History note"
                  htmlFor="seller-order-history-note"
                  error={visibleErrors.note}
                >
                  <textarea
                    id="seller-order-history-note"
                    className="form-control"
                    rows={2}
                    value={form.note}
                    maxLength={MAX_STATUS_NOTE_LENGTH}
                    placeholder="Optional note for status history"
                    onChange={(e) => updateField('note', e.target.value)}
                    onBlur={() => {
                      if (!dirty) return;
                      setVisibleErrors((prev) => ({
                        ...prev,
                        ...(fieldErrors.note ? { note: fieldErrors.note } : {}),
                      }));
                    }}
                  />
                </FormField>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={!canSubmit || mutating}
                >
                  {mutating
                    ? 'Updating…'
                    : sellerOrderUpdateActionLabel(detail.nextStatus)}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Order summary</h4>
          </div>
          <div className="card-body">
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">Subtotal</span>
              <span>{formatVnd(detail.subtotalAmount)}</span>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">Discount</span>
              <span>-{formatVnd(detail.discountAmount)}</span>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">Shipping</span>
              <span>{formatVnd(detail.shippingFee)}</span>
            </div>
            <hr />
            <div className="d-flex justify-content-between fw-medium">
              <span>Total</span>
              <span>{formatVnd(detail.totalAmount)}</span>
            </div>
            {detail.trackingCode ? (
              <p className="mb-0 mt-3 text-muted">
                Tracking:{' '}
                <span className="text-dark fw-medium">{detail.trackingCode}</span>
              </p>
            ) : null}
            {detail.buyerNote ? (
              <p className="mb-0 mt-2 text-muted">
                Buyer note: <span className="text-dark">{detail.buyerNote}</span>
              </p>
            ) : null}
          </div>
        </div>

        {detail.payment ? (
          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Payment</h4>
            </div>
            <div className="card-body">
              <p className="mb-1 text-dark fw-medium">
                {detail.payment.provider}{' '}
                <span className={sellerOrderStatusBadgeClass(
                  detail.payment.status === 'Succeeded' ? 'Paid' : detail.payment.status,
                )}>
                  {detail.payment.status}
                </span>
              </p>
              <p className="mb-1 text-muted">
                Amount: <span className="text-dark">{formatVnd(detail.payment.amount)}</span>
              </p>
              <p className="mb-0 text-muted">
                Paid at: {formatOrderDate(detail.payment.paidAt)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="card">
          <div className="card-header">
            <h4 className="card-title">Customer details</h4>
          </div>
          <div className="card-body">
            <p className="mb-1 fw-medium text-dark">{detail.buyerName}</p>
            {detail.buyerEmail ? (
              <p className="mb-1">
                <a href={`mailto:${detail.buyerEmail}`} className="link-primary fw-medium">
                  {detail.buyerEmail}
                </a>
              </p>
            ) : null}
            {detail.buyerPhone ? <p className="mb-3 text-muted">{detail.buyerPhone}</p> : null}

            <h5 className="mt-3">Shipping address</h5>
            <p className="mb-1">{detail.shipping.receiverName}</p>
            <p className="mb-1">{shippingLine}</p>
            <p className="mb-0">{detail.shipping.phone}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const FULFILLMENT_ORDER = ['Paid', 'Confirmed', 'Shipping', 'Delivered', 'Completed'] as const;

function isStepReached(currentStatus: string, step: (typeof FULFILLMENT_ORDER)[number]): boolean {
  if (currentStatus === 'Cancelled' || currentStatus === 'PendingPayment') return false;
  if (currentStatus === 'ReturnRequested' || currentStatus === 'Returned') {
    return FULFILLMENT_ORDER.indexOf(step) <= FULFILLMENT_ORDER.indexOf('Delivered');
  }
  const currentIdx = FULFILLMENT_ORDER.indexOf(
    currentStatus as (typeof FULFILLMENT_ORDER)[number],
  );
  const stepIdx = FULFILLMENT_ORDER.indexOf(step);
  if (currentIdx < 0) return false;
  return stepIdx <= currentIdx;
}
