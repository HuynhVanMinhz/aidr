import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
import {
  clearCheckoutSuccess,
  confirmMockPayOsReturn,
  createPayOsLinksForOrders,
  hydrateCheckoutSuccess,
  selectCheckoutLastSuccess,
  selectCheckoutPaying,
} from '../../store/checkoutSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import type { CreatedOrder } from '../../types/order';
import type { OrderPaymentLink } from '../../types/payment';
import { loadCheckoutSuccess } from '../../utils/checkoutStorage';
import { formatMoney } from '../../utils/formatCatalog';
import { formatOrderDate, formatOrderStatus, orderStatusClass } from '../../utils/orderUi';

const PLACEHOLDER = '/theme/images/product-image-1.png';

function formatAddressLine(parts: {
  streetAddress: string;
  ward: string;
  district: string;
  province: string;
}) {
  return `${parts.streetAddress}, ${parts.ward}, ${parts.district}, ${parts.province}`;
}

function isPaidStatus(status: string | undefined | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'succeeded' || s === 'paid';
}

function paymentLabel(orderPaymentStatus: string, link?: OrderPaymentLink) {
  const status = link?.paymentStatus || orderPaymentStatus;
  if (isPaidStatus(status) || isPaidStatus(link?.orderStatus)) return 'Paid';
  if (status?.toLowerCase() === 'pending') return 'Payment pending';
  return status || 'Pending';
}

export function OrderReceivedPage() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const success = useAppSelector(selectCheckoutLastSuccess);
  const paying = useAppSelector(selectCheckoutPaying);
  const [confirmingMock, setConfirmingMock] = useState(false);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const mockHandledRef = useRef(false);

  const cancelled = searchParams.get('cancelled') === '1' || searchParams.get('cancel') === '1';
  const returnOrderId = searchParams.get('orderId');

  useEffect(() => {
    if (success) return;
    const stored = loadCheckoutSuccess();
    if (stored) dispatch(hydrateCheckoutSuccess(stored));
  }, [dispatch, success]);

  useEffect(() => {
    if (!success || mockHandledRef.current) return;

    const mockPayOs = searchParams.get('mockPayOs');
    const orderId = searchParams.get('orderId');
    const paymentLinkId = searchParams.get('paymentLinkId');
    if (mockPayOs !== '1' || !orderId || !paymentLinkId) return;

    mockHandledRef.current = true;
    setConfirmingMock(true);

    void (async () => {
      const result = await dispatch(confirmMockPayOsReturn({ orderId, paymentLinkId }));
      setConfirmingMock(false);

      if (confirmMockPayOsReturn.rejected.match(result)) {
        toast.error(result.payload || 'Unable to confirm mock payment.');
      } else {
        toast.success('Mock payment confirmed.');
      }

      const next = new URLSearchParams(searchParams);
      next.delete('mockPayOs');
      next.delete('paymentLinkId');
      setSearchParams(next, { replace: true });
    })();
  }, [dispatch, searchParams, setSearchParams, success, toast]);

  const paymentsByOrderId = useMemo(() => {
    const map = new Map<string, OrderPaymentLink>();
    for (const p of success?.payments ?? []) map.set(p.orderId, p);
    return map;
  }, [success?.payments]);

  const orders = useMemo(() => success?.orders ?? [], [success?.orders]);

  const allPaid =
    orders.length > 0 &&
    orders.every((o) => {
      const link = paymentsByOrderId.get(o.orderId);
      return (
        isPaidStatus(o.paymentStatus) || isPaidStatus(link?.paymentStatus) || isPaidStatus(o.status)
      );
    });

  const pendingOrders = orders.filter((o) => {
    const link = paymentsByOrderId.get(o.orderId);
    return !(
      isPaidStatus(o.paymentStatus) ||
      isPaidStatus(link?.paymentStatus) ||
      isPaidStatus(o.status)
    );
  });

  // Page notices are toasts, not banners.
  const cancelNotice = cancelled
    ? 'Payment cancelled — your order is still reserved. Retry payment.'
    : null;
  const returnNotice =
    returnOrderId && !cancelled && !searchParams.get('mockPayOs')
      ? allPaid
        ? 'Payment completed. Thank you!'
        : 'If you finished paying on payOS, the status updates as soon as the webhook arrives.'
      : null;

  useToastMessage(cancelNotice, 'warning');
  useToastMessage(returnNotice, allPaid ? 'success' : 'info');

  if (!success || success.orders.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const { grandTotal, currency, shipping, buyerNote } = success;
  const primary = orders[0];
  const singleOrder = orders.length === 1;
  const amountDue = pendingOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const subtotalAll = orders.reduce((sum, o) => sum + o.subtotalAmount, 0);
  const discountAll = orders.reduce((sum, o) => sum + o.discountAmount, 0);
  const shippingAll = orders.reduce((sum, o) => sum + o.shippingFee, 0);
  const busyPay = paying || retryingOrderId !== null || confirmingMock;

  async function handlePayNow(orderId: string) {
    const existing = paymentsByOrderId.get(orderId);
    if (existing?.checkoutUrl && !isPaidStatus(existing.paymentStatus)) {
      window.location.assign(existing.checkoutUrl);
      return;
    }

    const order = orders.find((o) => o.orderId === orderId);
    if (!order) {
      toast.error('Order not found.');
      return;
    }

    setRetryingOrderId(orderId);
    const result = await dispatch(createPayOsLinksForOrders([order]));
    setRetryingOrderId(null);

    if (createPayOsLinksForOrders.rejected.match(result)) {
      toast.error(result.payload || 'Unable to create payment link.');
      return;
    }

    const link = result.payload.find((p) => p.orderId === orderId);
    if (!link?.checkoutUrl) {
      toast.error('Payment link was not returned.');
      return;
    }
    window.location.assign(link.checkoutUrl);
  }

  function payButtonLabel(order: CreatedOrder) {
    if (busyPay) return 'Please wait…';
    const link = paymentsByOrderId.get(order.orderId);
    return link?.checkoutUrl ? 'Pay now' : 'Create payment link';
  }

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Order Received</h1>
                <CatalogBreadcrumb
                  items={[{ label: 'Home', to: '/' }, { label: 'Order Received' }]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-order-receive">
        <div className="container">
          <div className="receipt-intro">
            <p className="receipt-intro__code">
              {singleOrder ? primary.orderCode : `${orders.length} orders placed`}
              <span className="receipt-intro__date">{formatOrderDate(primary.createdAt)}</span>
            </p>
            <p className="receipt-intro__lead">
              Thank you. Your order{singleOrder ? ' has' : 's have'} been received and stock is
              reserved.{' '}
              {allPaid
                ? 'Payment is complete.'
                : 'Complete payment with payOS to confirm your purchase.'}
            </p>
          </div>

          <div className="row receipt-layout">
            {/* Left — what was ordered */}
            <div className="col-xl-7 receipt-main-col">
              {orders.map((order) => {
                const link = paymentsByOrderId.get(order.orderId);
                const paid =
                  isPaidStatus(order.paymentStatus) ||
                  isPaidStatus(link?.paymentStatus) ||
                  isPaidStatus(order.status);
                const status = link?.orderStatus || order.status;

                return (
                  <section key={order.orderId} className="receipt-card">
                    <div className="receipt-card__head">
                      <div className="receipt-card__heading">
                        <h2 className="receipt-card__title">Order details</h2>
                        <p className="receipt-card__sub">
                          {order.orderCode} · {order.shopName}
                        </p>
                      </div>
                      <span className={orderStatusClass(status)}>{formatOrderStatus(status)}</span>
                    </div>

                    <ul className="receipt-line-list">
                      {order.items.map((item) => (
                        <li key={item.orderItemId} className="receipt-line">
                          <span className="receipt-line__thumb">
                            <img
                              src={item.imageUrl || PLACEHOLDER}
                              alt=""
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') return;
                                img.dataset.fallback = '1';
                                img.src = PLACEHOLDER;
                              }}
                            />
                          </span>
                          <span className="receipt-line__info">
                            <span className="receipt-line__name">{item.productName}</span>
                            <span className="receipt-line__meta">
                              {item.sku ? <span>{item.sku}</span> : null}
                              <span>Qty {item.quantity}</span>
                              <span>{formatMoney(item.unitPrice, order.currency)} each</span>
                            </span>
                          </span>
                          <span className="receipt-line__price">
                            {formatMoney(item.lineTotal, order.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="receipt-card__foot">
                      <span className="receipt-card__foot-label">Order total</span>
                      <span className="receipt-card__foot-value">
                        {formatMoney(order.totalAmount, order.currency)}
                      </span>
                    </div>

                    {!paid && !singleOrder && (
                      <button
                        type="button"
                        className="receipt-pay-btn receipt-pay-btn--inline"
                        disabled={busyPay}
                        onClick={() => void handlePayNow(order.orderId)}
                      >
                        {payButtonLabel(order)}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Right — finish paying */}
            <div className="col-xl-5 receipt-side-col">
              <div className="receipt-sidebar">
                <section className="receipt-card receipt-payment">
                  <div className="receipt-card__head">
                    <div className="receipt-card__heading">
                      <h2 className="receipt-card__title">Payment summary</h2>
                      <p className="receipt-card__sub">Online payment (payOS)</p>
                    </div>
                    <span
                      className={orderStatusClass(allPaid ? 'Paid' : 'PendingPayment')}
                      aria-label={allPaid ? 'Paid' : 'Payment pending'}
                    >
                      {allPaid ? '🟢 Paid' : '🟡 Payment Pending'}
                    </span>
                  </div>

                  <div className="receipt-totals">
                    <p className="receipt-totals__row">
                      <span>Subtotal</span>
                      <span>{formatMoney(subtotalAll, currency)}</span>
                    </p>
                    {discountAll > 0 && (
                      <p className="receipt-totals__row receipt-totals__row--discount">
                        <span>Discount</span>
                        <span>−{formatMoney(discountAll, currency)}</span>
                      </p>
                    )}
                    <p className="receipt-totals__row">
                      <span>Shipping</span>
                      <span>
                        {shippingAll > 0 ? formatMoney(shippingAll, currency) : 'Free'}
                      </span>
                    </p>
                    <p className="receipt-totals__grand">
                      <span>Total</span>
                      <span>{formatMoney(grandTotal, currency)}</span>
                    </p>
                  </div>

                  {!allPaid && singleOrder && (
                    <>
                      <button
                        type="button"
                        className="receipt-pay-btn"
                        disabled={busyPay}
                        onClick={() => void handlePayNow(primary.orderId)}
                      >
                        {payButtonLabel(primary)}
                        <span className="receipt-pay-btn__amount">
                          {formatMoney(amountDue, currency)}
                        </span>
                      </button>
                      <p className="receipt-payment__hint">
                        {paymentLabel(primary.paymentStatus, paymentsByOrderId.get(primary.orderId))}{' '}
                        · you will be redirected to payOS.
                      </p>
                    </>
                  )}

                  {!allPaid && !singleOrder && (
                    <p className="receipt-payment__hint">
                      {pendingOrders.length} of {orders.length} orders still need payment
                      ({formatMoney(amountDue, currency)}). Pay each one from the list on the left.
                    </p>
                  )}

                  {allPaid && (
                    <p className="receipt-payment__hint receipt-payment__hint--ok">
                      Payment received. We have notified the shop.
                    </p>
                  )}
                </section>

                <section className="receipt-card receipt-shipping">
                  <div className="receipt-card__head">
                    <div className="receipt-card__heading">
                      <h2 className="receipt-card__title">Shipping address</h2>
                    </div>
                  </div>
                  <p className="receipt-shipping__name">{shipping.receiverName}</p>
                  <p className="receipt-shipping__row">
                    <i className="fa-solid fa-location-dot" aria-hidden />
                    <span>{formatAddressLine(shipping)}</span>
                  </p>
                  <p className="receipt-shipping__row">
                    <i className="fa-solid fa-phone" aria-hidden />
                    <a href={`tel:${shipping.phone}`}>{shipping.phone}</a>
                  </p>
                </section>

                {buyerNote ? (
                  <section className="receipt-card">
                    <div className="receipt-card__head">
                      <div className="receipt-card__heading">
                        <h2 className="receipt-card__title">Order note</h2>
                      </div>
                    </div>
                    <p className="receipt-note">{buyerNote}</p>
                  </section>
                ) : null}

                <div className="receipt-secondary-actions">
                  <Link
                    to="/account/orders"
                    className="receipt-secondary-link"
                    onClick={() => dispatch(clearCheckoutSuccess())}
                  >
                    View my orders
                  </Link>
                  <span className="receipt-secondary-sep" aria-hidden>
                    ·
                  </span>
                  <Link
                    to="/products"
                    className="receipt-secondary-link"
                    onClick={() => dispatch(clearCheckoutSuccess())}
                  >
                    Continue shopping
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: keep the primary CTA reachable without scrolling back up. */}
      {!allPaid && singleOrder && (
        <div className="receipt-sticky-pay">
          <div className="receipt-sticky-pay__amount">
            <span>Amount due</span>
            <strong>{formatMoney(amountDue, currency)}</strong>
          </div>
          <button
            type="button"
            className="receipt-pay-btn"
            disabled={busyPay}
            onClick={() => void handlePayNow(primary.orderId)}
          >
            {payButtonLabel(primary)}
          </button>
        </div>
      )}
    </>
  );
}
