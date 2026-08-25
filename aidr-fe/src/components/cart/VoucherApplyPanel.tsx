import { useMemo, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { useVouchers } from '../../hooks/useVouchers';
import { formatMoney } from '../../utils/formatCatalog';

export type VoucherShopOption = {
  shopId: string;
  shopName: string;
  subtotal: number;
};

type VoucherApplyPanelProps = {
  cartItemIds?: string[] | null;
  shopOptions: VoucherShopOption[];
  currency: string;
  /** `cart` = promocode form in order summary; `checkout` = coupon accordion. */
  variant?: 'cart' | 'checkout';
};

function formatDiscountLabel(item: {
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  currency?: string;
}) {
  if (item.discountType.toLowerCase() === 'percent') {
    const cap =
      item.maxDiscountAmount != null
        ? ` (max ${formatMoney(item.maxDiscountAmount, item.currency || 'VND')})`
        : '';
    return `${item.discountValue}% off${cap}`;
  }
  return `${formatMoney(item.discountValue, item.currency || 'VND')} off`;
}

export function VoucherApplyPanel({
  cartItemIds,
  shopOptions,
  currency,
  variant = 'cart',
}: VoucherApplyPanelProps) {
  const toast = useToast();
  const {
    items,
    loading,
    previewing,
    error,
    previewError,
    codeInput,
    applied,
    setCodeInput,
    applyCode,
    applyVoucher,
    remove,
    getErrorMessage,
  } = useVouchers({ autoLoad: true, cartItemIds });

  const defaultShopId = useMemo(() => {
    if (shopOptions.length === 0) return '';
    if (shopOptions.length === 1) return shopOptions[0].shopId;
    return [...shopOptions].sort((a, b) => b.subtotal - a.subtotal)[0]?.shopId ?? '';
  }, [shopOptions]);

  const [selectedShopId, setSelectedShopId] = useState(defaultShopId);
  const effectiveShopId = selectedShopId || defaultShopId;
  const needsShopPicker = shopOptions.length > 1;

  async function handleApplyCode() {
    try {
      const appliedResult = await applyCode(codeInput, effectiveShopId || null);
      toast.success(`Applied ${appliedResult.code} (−${formatMoney(appliedResult.discountAmount, currency)}).`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to apply voucher.'));
    }
  }

  async function handleApplyItem(voucherId: string) {
    const item = items.find((v) => v.voucherId === voucherId);
    if (!item) return;
    try {
      const shopId =
        item.scope.toLowerCase() === 'shop'
          ? item.shopId
          : effectiveShopId || null;
      const appliedResult = await applyVoucher(item, shopId);
      toast.success(`Applied ${appliedResult.code}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to apply voucher.'));
    }
  }

  const appliedIds = useMemo(
    () => new Set(applied.map((a) => a.voucherId)),
    [applied],
  );

  const formBlock = (
    <>
      {needsShopPicker && (
        <div className="voucher-shop-picker form-group">
          <label htmlFor={`voucher-shop-${variant}`}>Apply system voucher to shop</label>
          <select
            id={`voucher-shop-${variant}`}
            className="form-control"
            value={effectiveShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            disabled={previewing}
          >
            {shopOptions.map((shop) => (
              <option key={shop.shopId} value={shop.shopId}>
                {shop.shopName} ({formatMoney(shop.subtotal, currency)})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={variant === 'cart' ? 'order-summary-promocode-form' : 'coupon-apply-form'}>
        <div className="form-group">
          <input
            type="text"
            name="promo"
            className="form-control"
            placeholder="Add promo code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            disabled={previewing}
            aria-label="Voucher code"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleApplyCode();
              }
            }}
          />
          {variant === 'cart' && (
            <button
              type="button"
              className="btn-default btn-accent"
              disabled={previewing || !codeInput.trim()}
              onClick={() => void handleApplyCode()}
            >
              {previewing ? 'Applying…' : 'Apply'}
            </button>
          )}
        </div>
        {variant === 'checkout' && (
          <div className="coupon-apply-btn">
            <button
              type="button"
              className="btn-default btn-accent"
              disabled={previewing || !codeInput.trim()}
              onClick={() => void handleApplyCode()}
            >
              {previewing ? 'Applying…' : 'Apply Coupon'}
            </button>
          </div>
        )}
      </div>

      {(previewError || error) && (
        <p className="form-field-error voucher-panel-error" role="alert">
          {previewError || error}
        </p>
      )}

      {applied.length > 0 && (
        <ul className="voucher-applied-list">
          {applied.map((v) => (
            <li key={v.shopId} className="voucher-applied-item">
              <div>
                <strong>{v.code}</strong>
                <span>
                  −{formatMoney(v.discountAmount, v.currency || currency)}
                  {v.shopName ? ` · ${v.shopName}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="voucher-remove-btn"
                onClick={() => remove(v.shopId)}
                disabled={previewing}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="voucher-available-list">
        {loading && items.length === 0 ? (
          <p className="voucher-available-hint">Loading vouchers…</p>
        ) : items.length === 0 ? (
          <p className="voucher-available-hint">No vouchers available for this cart.</p>
        ) : (
          <ul>
            {items.map((item) => {
              const isApplied = appliedIds.has(item.voucherId);
              return (
                <li key={item.voucherId} className={!item.isEligible ? 'voucher-item--ineligible' : ''}>
                  <div className="voucher-item-main">
                    <strong>{item.code}</strong>
                    <span>{item.name}</span>
                    <span className="voucher-item-meta">
                      {formatDiscountLabel({ ...item, currency })}
                      {item.scope === 'Shop' && item.shopName ? ` · ${item.shopName}` : ' · Platform'}
                      {item.minOrderAmount > 0
                        ? ` · Min ${formatMoney(item.minOrderAmount, currency)}`
                        : ''}
                    </span>
                    {!item.isEligible && item.ineligibilityReason && (
                      <span className="voucher-item-reason">{item.ineligibilityReason}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-default btn-accent btn-border voucher-item-apply"
                    disabled={previewing || !item.isEligible || isApplied}
                    onClick={() => void handleApplyItem(item.voucherId)}
                  >
                    {isApplied ? 'Applied' : 'Apply'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );

  if (variant === 'checkout') {
    return (
      <div className="checkout-coupon-accordion voucher-checkout-panel">
        <h2 className="coupon-accordion-header" id="coupon_heading1">
          <button
            className="coupon-accordion-button"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#coupon_collapse1"
            aria-expanded="true"
            aria-controls="coupon_collapse1"
          >
            Have a coupon? <b>Click here to enter your code</b>
          </button>
        </h2>
        <div
          id="coupon_collapse1"
          className="accordion-collapse collapse show"
          role="region"
          aria-labelledby="coupon_heading1"
        >
          <div className="coupon-accordion-body">
            <div className="coupon-accordion-body-content">
              <p>If you have a coupon code, please apply it below. You can also pick from available vouchers.</p>
            </div>
            {formBlock}
          </div>
        </div>
      </div>
    );
  }

  return <div className="voucher-cart-panel">{formBlock}</div>;
}
