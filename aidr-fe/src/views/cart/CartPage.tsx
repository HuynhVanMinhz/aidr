import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { CartItemRow } from '../../components/cart/CartItemRow';
import { CartOrderSummary } from '../../components/cart/CartOrderSummary';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { useAppSelector } from '../../store/hooks';
import { selectAppliedDiscountTotal, selectAppliedVouchers } from '../../store/voucherSlice';

const MAX_QTY = 99;
const DESKTOP_SUMMARY_MQ = '(min-width: 1200px)';

function useDesktopSummary() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_SUMMARY_MQ).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_SUMMARY_MQ);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
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
  const applied = useAppSelector(selectAppliedVouchers);
  const discountTotal = useAppSelector(selectAppliedDiscountTotal);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const cartItemIds = useMemo(() => items.map((i) => i.cartItemId), [items]);
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const shopOptions = useMemo(() => {
    const map = new Map<string, { shopId: string; shopName: string; subtotal: number }>();
    for (const item of items) {
      const existing = map.get(item.shopId);
      if (existing) {
        existing.subtotal += item.lineTotal;
      } else {
        map.set(item.shopId, {
          shopId: item.shopId,
          shopName: item.shopName,
          subtotal: item.lineTotal,
        });
      }
    }
    return [...map.values()];
  }, [items]);

  const payableTotal = Math.max(0, subtotal - discountTotal);
  const hasAvailableItems = items.some((i) => i.isAvailable);
  const busy = mutating || busyItemId != null;
  const isDesktopSummary = useDesktopSummary();

  const orderSummaryProps = {
    itemCount,
    subtotal,
    discountTotal,
    appliedCount: applied.length,
    payableTotal,
    currency,
    cartItemIds,
    shopOptions,
    checkoutDisabled: !hasAvailableItems,
  };

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
            <p className="cart-loading">Loading cart…</p>
          ) : items.length === 0 ? (
            <div className="cart-empty-state">
              <h2>Your cart is empty</h2>
              <p>Browse products and add items to start checkout.</p>
              <Link to="/products" className="btn-default btn-accent">
                <i className="fa-solid fa-arrow-left" aria-hidden />
                Continue Shopping
              </Link>
            </div>
          ) : (
            <>
              <div className="row cart-page-layout">
                <div className="col-xl-8">
                  <div className="cart-items-panel">
                    <header className="cart-items-panel__head">
                      <div>
                        <h2>Your items</h2>
                        <p>
                          {itemCount} {itemCount === 1 ? 'item' : 'items'} in your cart
                        </p>
                      </div>
                    </header>

                    <div className="cart-list-header" aria-hidden>
                      <span>Product</span>
                      <span>Price</span>
                      <span>Quantity</span>
                      <span>Subtotal</span>
                    </div>

                    <div className="cart-list">
                      {items.map((item, index) => {
                        const itemBusy = busyItemId === item.cartItemId || busyItemId === '__clear__';
                        return (
                          <CartItemRow
                            key={item.cartItemId}
                            item={item}
                            index={index}
                            busy={itemBusy || busy}
                            onChangeQty={(id, qty, max) => void changeQty(id, qty, max)}
                            onRemove={(id) => void handleRemove(id)}
                          />
                        );
                      })}
                    </div>

                    <footer className="cart-actions-footer">
                      <Link to="/products" className="cart-action-btn cart-action-btn--secondary">
                        <i className="fa-solid fa-arrow-left" aria-hidden />
                        Continue Shopping
                      </Link>
                      <button
                        type="button"
                        className="cart-action-btn cart-action-btn--danger"
                        disabled={busy}
                        onClick={() => void handleClear()}
                      >
                        <i className="fa-regular fa-trash-can" aria-hidden />
                        Clear Cart
                      </button>
                    </footer>
                  </div>
                </div>

                <div className="col-xl-4 cart-summary-col">
                  {isDesktopSummary ? (
                    <CartOrderSummary {...orderSummaryProps} variant="sidebar" />
                  ) : null}
                </div>
              </div>

              {!isDesktopSummary ? (
                <CartOrderSummary {...orderSummaryProps} variant="mobile" />
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
