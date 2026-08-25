import { Link, Navigate } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { clearCheckoutSuccess, selectCheckoutLastSuccess } from '../../store/checkoutSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
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

export function OrderReceivedPage() {
  const dispatch = useAppDispatch();
  const success = useAppSelector(selectCheckoutLastSuccess);

  if (!success || success.orders.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const { orders, grandTotal, currency, shipping, buyerNote } = success;
  const primary = orders[0];

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
          <div className="row">
            <div className="col-xl-4 col-lg-5">
              <div className="page-single-sidebar">
                <div className="order-receive-sidebar">
                  <div className="order-receive-sidebar-item order-receive-box">
                    <h2 className="order-sidebar-item-title">Order summary</h2>
                    <ul>
                      <li>
                        Orders<span>
                          <b>{orders.length}</b>
                        </span>
                      </li>
                      <li>
                        Order date<span>{formatOrderDate(primary.createdAt)}</span>
                      </li>
                      <li>
                        Payment<span>Online (payOS) — Pending</span>
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
                    stock has been reserved. Payment can be completed when payOS checkout is
                    available.
                  </p>
                </div>

                {orders.map((order) => (
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
                        <span>{order.status}</span>
                      </li>
                      <li>
                        Payment
                        <span>{order.paymentStatus}</span>
                      </li>
                    </ul>
                  </div>
                ))}

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
                  <Link to="/cart" className="btn-default" onClick={() => dispatch(clearCheckoutSuccess())}>
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
