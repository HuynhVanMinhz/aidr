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
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const effectiveShopId = selectedShopId || defaultShopId;
  const needsShopPicker = shopOptions.length > 1;
  const promoError = previewError || error;

  async function handleApplyCode() {
    setPromoSuccess(null);
    try {
      const appliedResult = await applyCode(codeInput, effectiveShopId || null);
      setPromoSuccess(`Voucher ${appliedResult.code} applied.`);
      toast.success(`Applied ${appliedResult.code} (−${formatMoney(appliedResult.discountAmount, currency)}).`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to apply voucher.'));
    }
  }

  async function handleApplyItem(voucherId: string) {
    const item = items.find((v) => v.voucherId === voucherId);
    if (!item) return;
    setPromoSuccess(null);
    try {
      const shopId =
        item.scope.toLowerCase() === 'shop' ? item.shopId : effectiveShopId || null;
      const appliedResult = await applyVoucher(item, shopId);
      setPromoSuccess(`Voucher ${appliedResult.code} applied.`);
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
        <div className="voucher-shop-picker">
          <label htmlFor={`voucher-shop-${variant}`}>Apply platform voucher to shop</label>
          <select
            id={`voucher-shop-${variant}`}
            className="catalog-filter-field voucher-shop-picker__select"
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

      <div
        className={`voucher-promo-row${
          promoError ? ' voucher-promo-row--error' : promoSuccess ? ' voucher-promo-row--success' : ''
        }`}
      >
        <div className="voucher-promo-row__field">
          <i className="fa-solid fa-tag voucher-promo-row__icon" aria-hidden />
          <input
            type="text"
            className="voucher-promo-row__input"
            placeholder="Promo code"
            value={codeInput}
            onChange={(e) => {
              setPromoSuccess(null);
              setCodeInput(e.target.value.toUpperCase());
            }}
            disabled={previewing}
            aria-label="Voucher code"
            aria-invalid={Boolean(promoError)}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleApplyCode();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="voucher-promo-row__apply"
          disabled={previewing || !codeInput.trim()}
          onClick={() => void handleApplyCode()}
        >
          {previewing ? '…' : 'Apply'}
        </button>
      </div>

      {promoError ? (
        <p className="voucher-promo-feedback voucher-promo-feedback--error" role="alert">
          <i className="fa-solid fa-circle-exclamation" aria-hidden />
          {promoError}
        </p>
      ) : null}
      {!promoError && promoSuccess ? (
        <p className="voucher-promo-feedback voucher-promo-feedback--success" role="status">
          <i className="fa-solid fa-circle-check" aria-hidden />
          {promoSuccess}
        </p>
      ) : null}

      {applied.length > 0 ? (
        <ul className="voucher-applied-list">
          {applied.map((v) => (
            <li key={v.shopId} className="voucher-applied-card">
              <div className="voucher-applied-card__main">
                <span className="voucher-applied-card__badge">
                  <i className="fa-solid fa-check" aria-hidden />
                  Applied
                </span>
                <strong>{v.code}</strong>
                <span className="voucher-applied-card__amount">
                  −{formatMoney(v.discountAmount, v.currency || currency)}
                  {v.shopName ? ` · ${v.shopName}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="voucher-applied-card__remove"
                onClick={() => {
                  setPromoSuccess(null);
                  remove(v.shopId);
                }}
                disabled={previewing}
                aria-label={`Remove voucher ${v.code}`}
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="voucher-available-section">
        <p className="voucher-available-section__title">Available vouchers</p>
        {loading && items.length === 0 ? (
          <p className="voucher-available-section__hint">Loading vouchers…</p>
        ) : items.length === 0 ? (
          <p className="voucher-available-section__hint">No vouchers available for this cart.</p>
        ) : (
          <ul className="voucher-card-list">
            {items.map((item) => {
              const isApplied = appliedIds.has(item.voucherId);
              const disabled = previewing || !item.isEligible;
              return (
                <li key={item.voucherId}>
                  <div
                    className={`voucher-card${
                      isApplied ? ' voucher-card--applied' : ''
                    }${!item.isEligible ? ' voucher-card--ineligible' : ''}`}
                  >
                    <div className="voucher-card__head">
                      <span className="voucher-card__code">{item.code}</span>
                      {isApplied ? (
                        <span className="voucher-card__status">
                          <i className="fa-solid fa-check" aria-hidden />
                          Applied
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="voucher-card__apply"
                          disabled={disabled}
                          onClick={() => void handleApplyItem(item.voucherId)}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    <p className="voucher-card__name">{item.name}</p>
                    <p className="voucher-card__meta">
                      {formatDiscountLabel({ ...item, currency })}
                      {item.scope === 'Shop' && item.shopName ? ` · ${item.shopName}` : ' · Platform'}
                    </p>
                    {item.minOrderAmount > 0 ? (
                      <p className="voucher-card__condition">
                        Min order {formatMoney(item.minOrderAmount, currency)}
                      </p>
                    ) : null}
                    {!item.isEligible && item.ineligibilityReason ? (
                      <p className="voucher-card__reason">{item.ineligibilityReason}</p>
                    ) : null}
                  </div>
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
