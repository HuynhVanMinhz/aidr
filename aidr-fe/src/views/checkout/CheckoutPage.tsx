import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { VoucherApplyPanel } from '../../components/cart/VoucherApplyPanel';
import { useCart } from '../../hooks/useCart';
import { useProfile } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
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
  const unavailableNotice =
    unavailableCount > 0
      ? `${unavailableCount} item(s) in your cart are unavailable and will be skipped.`
      : null;

  useToastMessage(checkoutError);
  useToastMessage(unavailableNotice, 'warning');

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
  const totalUnits = useMemo(
    () => availableItems.reduce((sum, item) => sum + item.quantity, 0),
    [availableItems],
  );

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
              <div className="row checkout-layout">
                <div className="col-xl-7 checkout-main-col">
                  <section className="checkout-panel">
                    <div className="checkout-panel__head">
                      <div className="checkout-panel__heading">
                        <h2 className="checkout-panel__title">Shipping address</h2>
                        <p className="checkout-panel__hint">Where should we deliver this order?</p>
                      </div>
                      {addresses.length > 0 && (
                        <Link to="/account/addresses" className="checkout-panel__action">
                          <i className="fa-solid fa-pen-to-square" aria-hidden />
                          Add or edit
                        </Link>
                      )}
                    </div>

                    {addresses.length === 0 ? (
                      <div className="checkout-empty-addresses">
                        <p>You need at least one saved address to place an order.</p>
                        <Link to="/account/addresses" className="btn-default btn-accent">
                          Manage addresses
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div
                          className="checkout-address-list"
                          role="radiogroup"
                          aria-label="Shipping address"
                        >
                          {addresses.map((address) => {
                            const inputId = `ship-addr-${address.addressId}`;
                            const selected = shippingAddressId === address.addressId;
                            return (
                              <label
                                key={address.addressId}
                                htmlFor={inputId}
                                className={`checkout-address-card${
                                  selected ? ' checkout-address-card--selected' : ''
                                }`}
                              >
                                <input
                                  id={inputId}
                                  type="radio"
                                  name="shippingAddress"
                                  className="checkout-address-card__radio"
                                  value={address.addressId}
                                  checked={selected}
                                  onChange={() => {
                                    setShippingAddressId(address.addressId);
                                    setAddressTouched(true);
                                  }}
                                />
                                <span className="checkout-address-card__body">
                                  <span className="checkout-address-card__name">
                                    {address.receiverName}
                                    {address.isDefault && (
                                      <span className="checkout-address-card__badge">Default</span>
                                    )}
                                  </span>
                                  <span className="checkout-address-card__row">
                                    <i className="fa-solid fa-location-dot" aria-hidden />
                                    <span>{formatAddressLine(address)}</span>
                                  </span>
                                  <span className="checkout-address-card__row">
                                    <i className="fa-solid fa-phone" aria-hidden />
                                    <span>{address.phone}</span>
                                  </span>
                                </span>
                                <i
                                  className="fa-solid fa-circle-check checkout-address-card__check"
                                  aria-hidden
                                />
                              </label>
                            );
                          })}
                        </div>
                        {addressError && (
                          <p className="form-field-error" role="alert">
                            {addressError}
                          </p>
                        )}
                      </>
                    )}
                  </section>

                  <section className="checkout-panel">
                    <div className="checkout-panel__head">
                      <div className="checkout-panel__heading">
                        <h2 className="checkout-panel__title">Order notes</h2>
                        <p className="checkout-panel__hint">Optional — delivery instructions.</p>
                      </div>
                    </div>

                    <div className="checkout-note-group">
                      <label className="checkout-visually-hidden" htmlFor="checkout-notes">
                        Order notes (optional)
                      </label>
                      <textarea
                        id="checkout-notes"
                        name="notes"
                        className="checkout-note-input"
                        rows={3}
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
                  </section>
                </div>

                <div className="col-xl-5 checkout-side-col">
                  <div className="checkout-summary">
                    <VoucherApplyPanel
                      variant="checkout"
                      cartItemIds={cartItemIds}
                      shopOptions={shopOptions}
                      currency={currency}
                    />

                    <section className="checkout-summary-section">
                      <div className="checkout-summary-section__head">
                        <h3 className="checkout-summary-section__title">Your order</h3>
                        <span className="checkout-summary-section__count">
                          {totalUnits} item{totalUnits === 1 ? '' : 's'}
                        </span>
                      </div>

                      {shopGroups.map((group) => (
                        <div key={group.shopId} className="checkout-shop-group">
                          <p className="checkout-shop-group-title">
                            <i className="fa-solid fa-store" aria-hidden />
                            <Link to={`/shops/${encodeURIComponent(group.shopSlug || group.shopId)}`}>
                              {group.shopName}
                            </Link>
                          </p>
                          <ul className="checkout-line-list">
                            {group.items.map((item) => (
                              <li key={item.cartItemId} className="checkout-line">
                                <span className="checkout-line__thumb">
                                  <img
                                    src={item.primaryImageUrl || PLACEHOLDER}
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
                                <span className="checkout-line__info">
                                  <span className="checkout-line__name">{item.productName}</span>
                                  <span className="checkout-line__qty">Qty {item.quantity}</span>
                                </span>
                                <span className="checkout-line__price">
                                  {formatMoney(item.lineTotal, item.currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </section>

                    <section className="checkout-summary-section checkout-totals">
                      <p className="checkout-totals__row">
                        <span>Subtotal</span>
                        <span>{formatMoney(checkoutSubtotal, currency)}</span>
                      </p>
                      {discountTotal > 0 && (
                        <p className="checkout-totals__row checkout-totals__row--discount">
                          <span>Discount</span>
                          <span>−{formatMoney(discountTotal, currency)}</span>
                        </p>
                      )}
                      <p className="checkout-totals__row">
                        <span>Shipping</span>
                        <span>Free</span>
                      </p>
                      <p className="checkout-totals__row checkout-totals__row--grand">
                        <span>Total</span>
                        <span>{formatMoney(payableTotal, currency)}</span>
                      </p>
                    </section>

                    <section className="checkout-summary-section">
                      <div className="checkout-summary-section__head">
                        <h3 className="checkout-summary-section__title">Payment method</h3>
                      </div>

                      <label className="checkout-payment-option checkout-payment-option--selected">
                        <input
                          type="radio"
                          id="payos_online"
                          name="payment"
                          value="payos"
                          checked
                          readOnly
                        />
                        <span className="checkout-payment-option__body">
                          <span className="checkout-payment-option__title">
                            Online payment (payOS)
                          </span>
                          <span className="checkout-payment-option__hint">
                            After placing your order you will be redirected to payOS to complete
                            payment securely.
                          </span>
                        </span>
                      </label>

                      {shopGroups.length > 1 && (
                        <p className="checkout-split-note">
                          <i className="fa-solid fa-circle-info" aria-hidden />
                          <span>
                            Items from {shopGroups.length} shops will create {shopGroups.length}{' '}
                            separate orders, each paid separately.
                          </span>
                        </p>
                      )}
                    </section>

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
                            : `Place order & pay · ${formatMoney(payableTotal, currency)}`}
                      </button>
                      <p className="checkout-back-to-cart">
                        <Link to="/cart">
                          <i className="fa-solid fa-arrow-left" aria-hidden /> Back to cart
                        </Link>
                      </p>
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
