import { useState } from 'react';
import { Link } from 'react-router-dom';
import { VoucherApplyPanel, type VoucherShopOption } from './VoucherApplyPanel';
import { formatMoney } from '../../utils/formatCatalog';

/** Matches backend `OrderConstants.DefaultShippingFee`. */
const ESTIMATED_SHIPPING_FEE = 0;

type Props = {
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  appliedCount: number;
  payableTotal: number;
  currency: string;
  cartItemIds: string[];
  shopOptions: VoucherShopOption[];
  checkoutDisabled: boolean;
  variant?: 'sidebar' | 'mobile';
};

export function CartOrderSummary({
  itemCount,
  subtotal,
  discountTotal,
  appliedCount,
  payableTotal,
  currency,
  cartItemIds,
  shopOptions,
  checkoutDisabled,
  variant = 'sidebar',
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const shippingLabel =
    ESTIMATED_SHIPPING_FEE <= 0 ? 'Free' : formatMoney(ESTIMATED_SHIPPING_FEE, currency);

  const totalsBlock = (
    <div className="cart-summary-totals">
      <div className="cart-summary-row">
        <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>
      {discountTotal > 0 ? (
        <div className="cart-summary-row cart-summary-row--discount">
          <span>
            <i className="fa-solid fa-tag" aria-hidden />
            Discount{appliedCount > 1 ? ` (${appliedCount})` : ''}
          </span>
          <span>−{formatMoney(discountTotal, currency)}</span>
        </div>
      ) : null}
      <div className="cart-summary-row cart-summary-row--shipping">
        <span>Estimated shipping</span>
        <span className={ESTIMATED_SHIPPING_FEE <= 0 ? 'is-free' : undefined}>
          {shippingLabel}
        </span>
      </div>
      <div className="cart-summary-row cart-summary-row--total">
        <span>Total</span>
        <strong>{formatMoney(payableTotal + ESTIMATED_SHIPPING_FEE, currency)}</strong>
      </div>
    </div>
  );

  const checkoutBtn = (
    <Link
      to="/checkout"
      className={`cart-summary-checkout${checkoutDisabled ? ' is-disabled' : ''}`}
      aria-disabled={checkoutDisabled}
      onClick={(e) => {
        if (checkoutDisabled) e.preventDefault();
      }}
    >
      Proceed to Checkout
      <i className="fa-solid fa-arrow-right" aria-hidden />
    </Link>
  );

  if (variant === 'mobile') {
    return (
      <div className="cart-mobile-summary">
        <button
          type="button"
          className="cart-mobile-summary__toggle"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span>
            Order summary
            <strong>{formatMoney(payableTotal + ESTIMATED_SHIPPING_FEE, currency)}</strong>
          </span>
          <i className={`fa-solid fa-chevron-${mobileOpen ? 'down' : 'up'}`} aria-hidden />
        </button>
        {mobileOpen ? (
          <div className="cart-mobile-summary__panel">
            <VoucherApplyPanel
              variant="cart"
              cartItemIds={cartItemIds}
              shopOptions={shopOptions}
              currency={currency}
            />
            {totalsBlock}
          </div>
        ) : null}
        {checkoutBtn}
      </div>
    );
  }

  return (
    <aside className="cart-summary-card">
      <header className="cart-summary-card__head">
        <h2>Order Summary</h2>
        <p className="cart-summary-card__meta">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
      </header>

      <div className="cart-summary-card__body">
        <VoucherApplyPanel
          variant="cart"
          cartItemIds={cartItemIds}
          shopOptions={shopOptions}
          currency={currency}
        />
        {totalsBlock}
      </div>

      <div className="cart-summary-card__foot">{checkoutBtn}</div>
    </aside>
  );
}
