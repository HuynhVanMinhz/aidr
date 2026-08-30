import { useEffect, useState } from 'react';
import { useToastMessage } from '../../hooks/useToastMessage';
import { listVouchers } from '../../services/voucherApi';
import type { VoucherListItem } from '../../types/voucher';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatMoney } from '../../utils/formatCatalog';

const PAGE_SIZE = 20;

function formatDiscount(item: VoucherListItem) {
  if (item.discountType.toLowerCase() === 'percent') {
    return `${item.discountValue}% off`;
  }
  return `${formatMoney(item.discountValue, 'VND')} off`;
}

function discountCap(item: VoucherListItem) {
  if (item.discountType.toLowerCase() !== 'percent' || item.maxDiscountAmount == null) {
    return null;
  }
  return `max ${formatMoney(item.maxDiscountAmount, 'VND')}`;
}

/** Same shape as everywhere else in the account area: 25 Feb 2027. */
function formatValidUntil(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function daysLeft(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

export function BuyerVouchersPage() {
  const [items, setItems] = useState<VoucherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useToastMessage(error);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listVouchers({ page: 1, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          throw new Error(result.message || 'Unable to load vouchers.');
        }
        setItems(result.data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eligibleCount = items.filter((v) => v.isEligible).length;

  return (
    <div className="account-page">
      <div className="account-toolbar">
        <p className="account-toolbar__lead">
          Browse available platform and shop vouchers. Eligibility may depend on your cart at
          checkout.
        </p>
        {items.length > 0 ? (
          <p className="account-count">
            {eligibleCount} of {items.length} usable
          </p>
        ) : null}
      </div>

      {loading ? <p className="account-muted">Loading vouchers…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="account-empty">
          <p>No vouchers are available right now.</p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="voucher-grid">
          {items.map((item) => {
            const cap = discountCap(item);
            const remaining = daysLeft(item.endsAt);

            return (
              <article
                key={item.voucherId}
                className={`voucher-tile${item.isEligible ? '' : ' voucher-tile--ineligible'}`}
              >
                <div className="voucher-tile__head">
                  <span className="voucher-tile__code">{item.code}</span>
                  {item.isEligible ? (
                    <span className="buyer-order-status buyer-order-status--completed">
                      Eligible
                    </span>
                  ) : (
                    <span className="buyer-order-status">Not eligible</span>
                  )}
                </div>

                <p className="voucher-tile__discount">
                  {formatDiscount(item)}
                  {cap ? <span className="voucher-tile__shop"> · {cap}</span> : null}
                </p>

                <div>
                  <p className="voucher-tile__name">{item.name}</p>
                  <p className="voucher-tile__shop">
                    {item.scope === 'System' ? 'Platform voucher' : item.shopName || 'Shop voucher'}
                  </p>
                </div>

                <p className="voucher-tile__facts">
                  <span>Min order {formatMoney(item.minOrderAmount, 'VND')}</span>
                  <span>
                    Valid until {formatValidUntil(item.endsAt)}
                    {remaining != null && remaining <= 14
                      ? ` · ${remaining} day${remaining === 1 ? '' : 's'} left`
                      : ''}
                  </span>
                </p>

                {!item.isEligible && item.ineligibilityReason ? (
                  <p className="voucher-tile__reason">{item.ineligibilityReason}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
