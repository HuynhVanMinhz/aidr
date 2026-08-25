import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { useToast } from '../../hooks/useToast';
import {
  clearCheckoutSuccess,
  confirmMockPayOsReturn,
  createPayOsLinksForOrders,
  hydrateCheckoutSuccess,
  selectCheckoutLastSuccess,
  selectCheckoutPaying,
} from '../../store/checkoutSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import type { OrderPaymentLink } from '../../types/payment';
import { loadCheckoutSuccess } from '../../utils/checkoutStorage';
import { formatMoney } from '../../utils/formatCatalog';

function formatAddressLine(parts: {
  streetAddress: string;
  ward: string;
  district: string;
  province: string;
}) {
  return `${parts.streetAddress}, ${parts.ward}, ${parts.district}, ${parts.province}`;
}

function formatOrderDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isPaidStatus(status: string | undefined | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'succeeded' || s === 'paid';
}

function paymentLabel(orderPaymentStatus: string, link?: OrderPaymentLink) {
  const status = link?.paymentStatus || orderPaymentStatus;
  if (isPaidStatus(status) || isPaidStatus(link?.orderStatus)) return 'Paid';
  if (status?.toLowerCase() === 'pending') return 'Pending payment';
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

  const returnOrderId = searchParams.get('orderId');
  const cancelled = searchParams.get('cancelled') === '1' || searchParams.get('cancel') === '1';

  const paymentsByOrderId = useMemo(() => {
    const map = new Map<string, OrderPaymentLink>();
    for (const p of success?.payments ?? []) map.set(p.orderId, p);
    return map;
  }, [success?.payments]);

  if (!success || success.orders.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const { orders, grandTotal, currency, shipping, buyerNote } = success;
  const primary = orders[0];
  const allPaid = orders.every((o) => {
    const link = paymentsByOrderId.get(o.orderId);
    return isPaidStatus(o.paymentStatus) || isPaidStatus(link?.paymentStatus) || isPaidStatus(o.status);
  });
  const pendingCount = orders.filter((o) => {
    const link = paymentsByOrderId.get(o.orderId);
    return !(isPaidStatus(o.paymentStatus) || isPaidStatus(link?.paymentStatus) || isPaidStatus(o.status));
  }).length;

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
          {cancelled && (
            <div className="alert alert-warning checkout-alerts" role="alert">
              Payment was cancelled. You can retry payment below while the order is still pending.
            </div>
          )}
          {returnOrderId && !cancelled && !searchParams.get('mockPayOs') && (
            <div className="alert alert-info checkout-alerts" role="alert">
              {confirmingMock
                ? 'Confirming payment…'
                : allPaid
                  ? 'Payment completed. Thank you!'
                  : 'If you finished paying on payOS, status will update shortly after the webhook is received. You can also use Pay now for any remaining orders.'}
            </div>
          )}

          <div className="row">
            <div className="col-xl-4 col-lg-5">
              <div className="page-single-sidebar">
                <div className="order-receive-sidebar">
                  <div className="order-receive-sidebar-item order-receive-box">
                    <h2 className="order-sidebar-item-title">Order summary</h2>
                    <ul>
                      <li>
                        Orders
                        <span>
                          <b>{orders.length}</b>
                        </span>
                      </li>
                      <li>
                        Order date<span>{formatOrderDate(primary.createdAt)}</span>
                      </li>
                      <li>
                        Payment
                        <span>
                          Online (payOS)
                          {allPaid ? ' — Paid' : pendingCount > 0 ? ` — ${pendingCount} pending` : ''}
                        </span>
                      </li>
                      <li>
                        Total<span>{formatMoney(grandTotal, currency)}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="order-receive-sidebar-item">
                    <h2 className="order-sidebar-item-title">Shipping address</h2>
                    <ul>
                      <li>{shipping.receiverName}</li>
                      <li>{formatAddressLine(shipping)}</li>
                      <li>
                        <a href={`tel:${shipping.phone}`}>{shipping.phone}</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-8 col-lg-7">
              <div className="order-receive-content-box">
                <div className="order-receive-title-box">
                  <h2>{orders.length === 1 ? `ORDER ${primary.orderCode}` : 'ORDERS PLACED'}</h2>
                  <p>
                    Thank you. Your order{orders.length > 1 ? 's have' : ' has'} been received and
                    stock has been reserved.
                    {allPaid
                      ? ' Payment is complete.'
                      : ' Complete online payment with payOS to confirm your purchase.'}
                  </p>
                </div>

                {orders.map((order) => {
                  const link = paymentsByOrderId.get(order.orderId);
                  const paid =
                    isPaidStatus(order.paymentStatus) ||
                    isPaidStatus(link?.paymentStatus) ||
                    isPaidStatus(order.status);
                  const busyPay = paying || retryingOrderId === order.orderId || confirmingMock;

                  return (
                    <div key={order.orderId} className="order-receive-content-list">
                      <ul>
                        <li className="order-receive-content-list-title">
                          {order.orderCode} · {order.shopName}
                          <span>{formatMoney(order.totalAmount, order.currency)}</span>
                        </li>
                        {order.items.map((item) => (
                          <li key={item.orderItemId}>
                            {item.productName} × {item.quantity}
                            <span>{formatMoney(item.lineTotal, order.currency)}</span>
                          </li>
                        ))}
                        <li>
                          Subtotal
                          <span>{formatMoney(order.subtotalAmount, order.currency)}</span>
                        </li>
                        <li>
                          Shipping
                          <span>
                            {order.shippingFee > 0
                              ? formatMoney(order.shippingFee, order.currency)
                              : 'Free'}
                          </span>
                        </li>
                        <li>
                          Status
                          <span>{link?.orderStatus || order.status}</span>
                        </li>
                        <li>
                          Payment
                          <span>{paymentLabel(order.paymentStatus, link)}</span>
                        </li>
                      </ul>

                      {!paid && (
                        <div className="order-receive-pay-actions">
                          <button
                            type="button"
                            className="btn-default btn-accent"
                            disabled={busyPay}
                            onClick={() => void handlePayNow(order.orderId)}
                          >
                            {busyPay ? 'Please wait…' : link?.checkoutUrl ? 'Pay now' : 'Create payment link'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {buyerNote ? (
                  <div className="order-receive-content-list">
                    <ul>
                      <li>
                        Note<span>{buyerNote}</span>
                      </li>
                    </ul>
                  </div>
                ) : null}

                <div className="order-receive-actions">
                  <Link
                    to="/products"
                    className="btn-default btn-accent"
                    onClick={() => dispatch(clearCheckoutSuccess())}
                  >
                    Continue Shopping
                  </Link>
                  <Link
                    to="/cart"
                    className="btn-default"
                    onClick={() => dispatch(clearCheckoutSuccess())}
                  >
                    Back to cart
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
