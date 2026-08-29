import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { CartItemRow } from '../../components/cart/CartItemRow';
import { CartOrderSummary } from '../../components/cart/CartOrderSummary';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
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
    currency,
    loading,
    mutating,
    error,
    loaded,
    setItemQuantity,
    removeItem,
    clearAll,
    selectedItems,
    selectableCount,
    isSelected,
    toggleSelected,
    selectAll,
    clearSelection,
    getErrorMessage,
  } = useCart({ autoLoad: true });
  const applied = useAppSelector(selectAppliedVouchers);
  const discountTotal = useAppSelector(selectAppliedDiscountTotal);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  useToastMessage(error);

  // Vouchers, totals and checkout all follow the ticked lines, not the whole cart.
  const cartItemIds = useMemo(
    () => selectedItems.map((i) => i.cartItemId),
    [selectedItems],
  );
  const itemCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems],
  );
  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [selectedItems],
  );
  const shopOptions = useMemo(() => {
    const map = new Map<string, { shopId: string; shopName: string; subtotal: number }>();
    for (const item of selectedItems) {
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
  }, [selectedItems]);

  const payableTotal = Math.max(0, selectedSubtotal - discountTotal);
  const selectedCount = selectedItems.length;
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const busy = mutating || busyItemId != null;
  const isDesktopSummary = useDesktopSummary();

  const orderSummaryProps = {
    itemCount,
    subtotal: selectedSubtotal,
    discountTotal,
    appliedCount: applied.length,
    payableTotal,
    currency,
    cartItemIds,
    shopOptions,
    checkoutDisabled: selectedCount === 0,
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
                          {selectedCount} of {items.length}{' '}
                          {items.length === 1 ? 'item' : 'items'} selected for checkout
                        </p>
                      </div>
                    </header>

                    <div className="cart-select-bar">
                      <input
                        type="checkbox"
                        id="cart-select-all"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = selectedCount > 0 && !allSelected;
                        }}
                        disabled={busy || selectableCount === 0}
                        onChange={() => (allSelected ? clearSelection() : selectAll())}
                      />
                      <label htmlFor="cart-select-all">
                        {allSelected ? 'Deselect all' : 'Select all'}
                      </label>
                      <span className="cart-select-bar__count">
                        {selectedCount} selected
                      </span>
                    </div>

                    <div className="cart-list-header" aria-hidden>
                      <span />
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
                            selected={isSelected(item.cartItemId)}
                            onToggleSelected={toggleSelected}
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
