import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { formatMoney } from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';
const MAX_QTY = 99;

function formatQty(value: number) {
  return String(value).padStart(2, '0');
}

export function CartPage() {
  const toast = useToast();
  const {
    items,
    subtotal,
    currency,
    loading,
    mutating,
    error,
    loaded,
    setItemQuantity,
    removeItem,
    clearAll,
    getErrorMessage,
  } = useCart({ autoLoad: true });
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  async function changeQty(cartItemId: string, nextQty: number, maxAvailable: number) {
    const qty = Math.min(Math.max(1, nextQty), Math.min(MAX_QTY, Math.max(1, maxAvailable)));
    setBusyItemId(cartItemId);
    try {
      await setItemQuantity(cartItemId, qty);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update quantity.'));
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleRemove(cartItemId: string) {
    setBusyItemId(cartItemId);
    try {
      await removeItem(cartItemId);
      toast.success('Item removed from cart.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to remove item.'));
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleClear() {
    if (items.length === 0) return;
    setBusyItemId('__clear__');
    try {
      await clearAll();
      toast.success('Cart cleared.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to clear cart.'));
    } finally {
      setBusyItemId(null);
    }
  }

  const busy = mutating || busyItemId != null;

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Cart</h1>
                <CatalogBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-cart">
        <div className="container">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {loading && !loaded ? (
            <p>Loading cart…</p>
          ) : items.length === 0 ? (
            <div className="cart-empty-state">
              <h2>Your cart is empty</h2>
              <p>Browse products and add items to start checkout.</p>
              <Link to="/products" className="btn-default btn-accent">
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="row">
              <div className="col-xl-8">
                <div className="cart-content-box">
                  <div className="cart-item-table-box">
                    <div className="cart-item-table">
                      <div className="cart-item-header">
                        <span className="product-header-tag">Product</span>
                        <span className="price-header-tag">Price</span>
                        <span className="quantity-header-tag">Quantity</span>
                        <span className="subtotal-header-tag">Subtotal</span>
                      </div>

                      {items.map((item) => {
                        const maxQty = Math.min(MAX_QTY, Math.max(1, item.availableQuantity));
                        const itemBusy = busyItemId === item.cartItemId || busyItemId === '__clear__';
                        return (
                          <div
                            key={item.cartItemId}
                            className={`cart-item${!item.isAvailable ? ' cart-item--unavailable' : ''}`}
                          >
                            <div className="cart-item-image-content">
                              <div className="cart-item-image">
                                <Link to={`/products/${item.productId}`}>
                                  <figure>
                                    <img
                                      src={item.primaryImageUrl || PLACEHOLDER}
                                      alt={item.productName}
                                    />
                                  </figure>
                                </Link>
                              </div>
                              <div className="cart-item-info-content">
                                <div className="cart-item-title">
                                  <p>
                                    <Link to={`/products/${item.productId}`}>{item.productName}</Link>
                                  </p>
                                  <p className="cart-item-shop">
                                    <Link to={`/shops/${encodeURIComponent(item.shopSlug || item.shopId)}`}>
                                      {item.shopName}
                                    </Link>
                                  </p>
                                  {!item.isAvailable && (
                                    <p className="cart-item-unavailable-note">Unavailable or out of stock</p>
                                  )}
                                  <button
                                    type="button"
                                    className="cart-item-remove"
                                    disabled={itemBusy || busy}
                                    onClick={() => void handleRemove(item.cartItemId)}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="cart-item-price">
                                  <p>{formatMoney(item.unitPriceSnapshot, item.currency)}</p>
                                  {item.currentPrice !== item.unitPriceSnapshot && (
                                    <p className="cart-item-current-price">
                                      Now {formatMoney(item.currentPrice, item.currency)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="cart-item-quantity-total">
                              <div className="cart-item-quantity">
                                <div className="qty-box">
                                  <button
                                    type="button"
                                    className="qty-btn minus"
                                    aria-label="Decrease quantity"
                                    disabled={itemBusy || busy || item.quantity <= 1}
                                    onClick={() =>
                                      void changeQty(item.cartItemId, item.quantity - 1, maxQty)
                                    }
                                  >
                                    -
                                  </button>
                                  <input
                                    type="text"
                                    className="qty-input"
                                    readOnly
                                    value={formatQty(item.quantity)}
                                    aria-label="Quantity"
                                  />
                                  <button
                                    type="button"
                                    className="qty-btn plus"
                                    aria-label="Increase quantity"
                                    disabled={
                                      itemBusy || busy || item.quantity >= maxQty || !item.isAvailable
                                    }
                                    onClick={() =>
                                      void changeQty(item.cartItemId, item.quantity + 1, maxQty)
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="cart-item-subtotal">
                                <p>{formatMoney(item.lineTotal, item.currency)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="cart-item-buttons">
                      <Link to="/products" className="btn-default btn-update">
                        Continue Shopping
                      </Link>
                      <button
                        type="button"
                        className="btn-default btn-clear"
                        disabled={busy}
                        onClick={() => void handleClear()}
                      >
                        Clear Cart
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-4">
                <div className="page-single-sidebar right-side-sidebar">
                  <div className="order-summary-box">
                    <div className="order-summary-content-box">
                      <div className="order-summary-box-title">
                        <h2>Order Summary</h2>
                      </div>
                      <div className="order-summary-promocode-box">
                        <div className="order-summary-total">
                          <h3>Subtotal</h3>
                          <h3>{formatMoney(subtotal, currency)}</h3>
                        </div>
                      </div>
                      <div className="order-summary-total">
                        <h3>Total</h3>
                        <h3>{formatMoney(subtotal, currency)}</h3>
                      </div>
                    </div>
                    <div className="order-checkout-button">
                      <Link
                        to="/checkout"
                        className={`btn-default btn-accent${
                          items.some((i) => i.isAvailable) ? '' : ' disabled'
                        }`}
                        aria-disabled={!items.some((i) => i.isAvailable)}
                        onClick={(e) => {
                          if (!items.some((i) => i.isAvailable)) e.preventDefault();
                        }}
                      >
                        Proceed to Checkout
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
