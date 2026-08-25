import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { VoucherApplyPanel } from '../../components/cart/VoucherApplyPanel';
import { useCart } from '../../hooks/useCart';
import { useProfile } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import {
  clearCheckoutError,
  createPayOsLinksForOrders,
  placeOrder,
  selectCheckoutError,
  selectCheckoutPaying,
  selectCheckoutSubmitting,
} from '../../store/checkoutSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAppliedVouchers,
  selectAppliedDiscountTotal,
  selectAppliedVouchers,
} from '../../store/voucherSlice';
import type { CartItem } from '../../types/cart';
import { formatMoney } from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';
const MAX_NOTE = 500;

function formatAddressLine(parts: {
  streetAddress: string;
  ward: string;
  district: string;
  province: string;
}) {
  return `${parts.streetAddress}, ${parts.ward}, ${parts.district}, ${parts.province}`;
}

function groupByShop(items: CartItem[]) {
  const map = new Map<string, { shopId: string; shopName: string; shopSlug: string; items: CartItem[] }>();
  for (const item of items) {
    const existing = map.get(item.shopId);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(item.shopId, {
        shopId: item.shopId,
        shopName: item.shopName,
        shopSlug: item.shopSlug,
        items: [item],
      });
    }
  }
  return [...map.values()];
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const {
    items,
    currency,
    loading: cartLoading,
    loaded: cartLoaded,
    getErrorMessage,
  } = useCart({ autoLoad: true });
  const { profile, loading: profileLoading } = useProfile();
  const submitting = useAppSelector(selectCheckoutSubmitting);
  const paying = useAppSelector(selectCheckoutPaying);
  const checkoutError = useAppSelector(selectCheckoutError);
  const appliedVouchers = useAppSelector(selectAppliedVouchers);
  const discountTotal = useAppSelector(selectAppliedDiscountTotal);
  const busy = submitting || paying;

  const addresses = profile?.addresses ?? [];
  const [shippingAddressId, setShippingAddressId] = useState('');
  const [buyerNote, setBuyerNote] = useState('');
  const [addressTouched, setAddressTouched] = useState(false);

  const availableItems = useMemo(() => items.filter((i) => i.isAvailable), [items]);
  const unavailableCount = items.length - availableItems.length;
  const shopGroups = useMemo(() => groupByShop(availableItems), [availableItems]);
  const checkoutSubtotal = useMemo(
    () => availableItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [availableItems],
  );
  const cartItemIds = useMemo(() => availableItems.map((i) => i.cartItemId), [availableItems]);
  const shopOptions = useMemo(
    () =>
      shopGroups.map((g) => ({
        shopId: g.shopId,
        shopName: g.shopName,
        subtotal: g.items.reduce((sum, item) => sum + item.lineTotal, 0),
      })),
    [shopGroups],
  );
  const payableTotal = Math.max(0, checkoutSubtotal - discountTotal);

  useEffect(() => {
    if (!addresses.length) {
      setShippingAddressId('');
      return;
    }
    setShippingAddressId((current) => {
      if (current && addresses.some((a) => a.addressId === current)) return current;
      const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
      return preferred.addressId;
    });
  }, [addresses]);

  useEffect(() => {
    return () => {
      dispatch(clearCheckoutError());
    };
  }, [dispatch]);

  const selectedAddress = addresses.find((a) => a.addressId === shippingAddressId) ?? null;
  const addressError =
    addressTouched && !shippingAddressId ? 'Please select a shipping address.' : null;
  const noteError =
    buyerNote.trim().length > MAX_NOTE
      ? `Order note must not exceed ${MAX_NOTE} characters.`
      : null;

  const canSubmit =
    !busy &&
    availableItems.length > 0 &&
    Boolean(shippingAddressId) &&
    !noteError;

  async function handlePlaceOrder(e: FormEvent) {
    e.preventDefault();
    setAddressTouched(true);

    if (!shippingAddressId) {
      toast.error('Please select a shipping address.');
      return;
    }
    if (noteError) {
      toast.error(noteError);
      return;
    }
    if (availableItems.length === 0) {
      toast.error('No available items to checkout.');
      return;
    }
    if (!selectedAddress) {
      toast.error('Please select a shipping address.');
      return;
    }

    const note = buyerNote.trim();
    const vouchers =
      appliedVouchers.length > 0
        ? appliedVouchers.map((v) => ({ shopId: v.shopId, voucherId: v.voucherId }))
        : null;

    const result = await dispatch(
      placeOrder({
        request: {
          shippingAddressId,
          cartItemIds: availableItems.map((i) => i.cartItemId),
          buyerNote: note || null,
          vouchers,
        },
        shipping: {
          receiverName: selectedAddress.receiverName,
          phone: selectedAddress.phone,
          province: selectedAddress.province,
          district: selectedAddress.district,
          ward: selectedAddress.ward,
          streetAddress: selectedAddress.streetAddress,
        },
        buyerNote: note || null,
      }),
    );

    if (placeOrder.rejected.match(result)) {
      toast.error(result.payload || getErrorMessage(result.error, 'Unable to create order.'));
      return;
    }

    dispatch(clearAppliedVouchers());

    const orders = result.payload.orders;
    toast.success(
      orders.length > 1 ? `${orders.length} orders created.` : 'Order created successfully.',
    );

    const payResult = await dispatch(createPayOsLinksForOrders(orders));
    if (createPayOsLinksForOrders.rejected.match(payResult)) {
      toast.error(payResult.payload || 'Unable to start payment. You can retry from the order page.');
      navigate('/order-received', { replace: true });
      return;
    }

    const links = payResult.payload;
    if (links.length === 1 && links[0].checkoutUrl) {
      toast.success('Redirecting to payment…');
      window.location.assign(links[0].checkoutUrl);
      return;
    }

    toast.success('Payment links ready. Complete payment for each order.');
    navigate('/order-received', { replace: true });
  }

  if (cartLoaded && items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const bootstrapping = (cartLoading && !cartLoaded) || profileLoading;

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Checkout</h1>
                <CatalogBreadcrumb
                  items={[
                    { label: 'Home', to: '/' },
                    { label: 'Cart', to: '/cart' },
                    { label: 'Checkout' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-checkout">
        <div className="container">
          {bootstrapping ? (
            <p>Loading checkout…</p>
          ) : (
            <form onSubmit={(e) => void handlePlaceOrder(e)}>
              {(checkoutError || unavailableCount > 0) && (
                <div className="checkout-alerts">
                  {checkoutError && (
                    <div className="alert alert-danger" role="alert">
                      {checkoutError}
                    </div>
                  )}
                  {unavailableCount > 0 && (
                    <div className="alert alert-warning" role="alert">
                      {unavailableCount} item(s) are unavailable and will be skipped.{' '}
                      <Link to="/cart">Review cart</Link>
                    </div>
                  )}
                </div>
              )}

              <div className="row">
                <div className="col-xl-7">
                  <div className="checkout-form-box">
                    <div className="checkout-bill-address-box">
                      <div className="checkout-bill-address-title">
                        <h2>Shipping address</h2>
                      </div>

                      {addresses.length === 0 ? (
                        <div className="checkout-empty-addresses">
                          <p>You need at least one saved address to place an order.</p>
                          <Link to="/account/addresses" className="btn-default btn-accent">
                            Manage addresses
                          </Link>
                        </div>
                      ) : (
                        <div className="checkout-address-list" role="radiogroup" aria-label="Shipping address">
                          {addresses.map((address) => {
                            const inputId = `ship-addr-${address.addressId}`;
                            return (
                              <label
                                key={address.addressId}
                                htmlFor={inputId}
                                className={`checkout-address-card${
                                  shippingAddressId === address.addressId
                                    ? ' checkout-address-card--selected'
                                    : ''
                                }`}
                              >
                                <input
                                  id={inputId}
                                  type="radio"
                                  name="shippingAddress"
                                  value={address.addressId}
                                  checked={shippingAddressId === address.addressId}
                                  onChange={() => {
                                    setShippingAddressId(address.addressId);
                                    setAddressTouched(true);
                                  }}
                                />
                                <span className="checkout-address-card-body">
                                  <strong>
                                    {address.receiverName}
                                    {address.isDefault ? ' (Default)' : ''}
                                  </strong>
                                  <span>{formatAddressLine(address)}</span>
                                  <span>{address.phone}</span>
                                </span>
                              </label>
                            );
                          })}
                          <p className="checkout-manage-addresses">
                            <Link to="/account/addresses">Add or edit addresses</Link>
                          </p>
                          {addressError && (
                            <p className="form-field-error" role="alert">
                              {addressError}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="checkout-bill-address-form">
                        <div className="form-group">
                          <label htmlFor="checkout-notes">Order notes (optional)</label>
                          <textarea
                            id="checkout-notes"
                            name="notes"
                            className="form-control"
                            rows={5}
                            maxLength={MAX_NOTE}
                            placeholder="Notes about your order, e.g. special notes for delivery."
                            value={buyerNote}
                            onChange={(e) => setBuyerNote(e.target.value)}
                          />
                          <p className="checkout-note-hint">
                            {buyerNote.trim().length}/{MAX_NOTE}
                          </p>
                          {noteError && (
                            <p className="form-field-error" role="alert">
                              {noteError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-xl-5">
                  <div className="page-single-sidebar right-side-sidebar">
                    <div className="checkout-sidebar-box">
                      <div className="product-total-order-box">
                        <VoucherApplyPanel
                          variant="checkout"
                          cartItemIds={cartItemIds}
                          shopOptions={shopOptions}
                          currency={currency}
                        />

                        <div className="product-total-order-title">
                          <h3>Your Order</h3>
                        </div>

                        <div className="product-total-order-list">
                          <div className="product-total-item-tag-list">
                            <span className="product-total-item-tag">Product</span>
                            <span className="product-total-item-tag">Subtotal</span>
                          </div>

                          {shopGroups.map((group) => (
                            <div key={group.shopId} className="checkout-shop-group">
                              <p className="checkout-shop-group-title">
                                <Link
                                  to={`/shops/${encodeURIComponent(group.shopSlug || group.shopId)}`}
                                >
                                  {group.shopName}
                                </Link>
                              </p>
                              {group.items.map((item) => (
                                <div key={item.cartItemId} className="product-total-item">
                                  <div className="product-total-item-header">
                                    <div className="product-total-item-image">
                                      <figure>
                                        <img
                                          src={item.primaryImageUrl || PLACEHOLDER}
                                          alt={item.productName}
                                        />
                                      </figure>
                                    </div>
                                    <div className="product-total-item-title">
                                      <p>
                                        {item.productName}{' '}
                                        <span className="checkout-item-qty">× {item.quantity}</span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="product-total-item-subtotal">
                                    <p>{formatMoney(item.lineTotal, item.currency)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}

                          <div className="all-product-total-list">
                            <div className="all-product-total">
                              <p>
                                Subtotal <span>{formatMoney(checkoutSubtotal, currency)}</span>
                              </p>
                            </div>
                            {discountTotal > 0 && (
                              <div className="all-product-total">
                                <p>
                                  Discount <span>−{formatMoney(discountTotal, currency)}</span>
                                </p>
                              </div>
                            )}
                            <div className="all-product-total">
                              <p>
                                Shipping <span>Free</span>
                              </p>
                            </div>
                            <div className="all-product-total">
                              <p>
                                Total <span>{formatMoney(payableTotal, currency)}</span>
                              </p>
                            </div>
                          </div>

                          <div className="order-payment-info">
                            <div className="order-payment-info-item">
                              <span>
                                <input
                                  type="radio"
                                  id="payos_online"
                                  name="payment"
                                  value="payos"
                                  checked
                                  readOnly
                                />
                                <label htmlFor="payos_online">Online payment (payOS)</label>
                              </span>
                              <p>
                                After placing your order you will be redirected to payOS to complete
                                payment securely.
                              </p>
                            </div>
                          </div>

                          {shopGroups.length > 1 && (
                            <p className="checkout-split-note">
                              Items from {shopGroups.length} shops will create {shopGroups.length}{' '}
                              separate orders. Each order is paid separately.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="place-order-button">
                        <button
                          type="submit"
                          className="btn-default btn-accent"
                          disabled={!canSubmit || addresses.length === 0}
                        >
                          {submitting
                            ? 'Placing order…'
                            : paying
                              ? 'Starting payment…'
                              : 'Place order & pay'}
                        </button>
                        <p className="checkout-back-to-cart">
                          <Link to="/cart">Back to cart</Link>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
