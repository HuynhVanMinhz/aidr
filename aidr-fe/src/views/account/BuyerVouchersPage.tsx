import { useEffect, useState } from 'react';
import { listVouchers } from '../../services/voucherApi';
import type { VoucherListItem } from '../../types/voucher';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatMoney } from '../../utils/formatCatalog';

const PAGE_SIZE = 20;

function formatDiscount(item: VoucherListItem) {
  if (item.discountType.toLowerCase() === 'percent') {
    const cap =
      item.maxDiscountAmount != null
        ? ` (max ${formatMoney(item.maxDiscountAmount, item.scope === 'System' ? 'VND' : 'VND')})`
        : '';
    return `${item.discountValue}%${cap}`;
  }
  return formatMoney(item.discountValue, 'VND');
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function BuyerVouchersPage() {
  const [items, setItems] = useState<VoucherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="account-order-detail-box">
      <p className="account-muted">
        Browse available platform and shop vouchers. Eligibility may depend on your cart at checkout.
      </p>

      {error ? (
        <div className="alert alert-danger buyer-orders-alert" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? <p className="account-muted">Loading vouchers…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="buyer-orders-empty">
          <p>No vouchers are available right now.</p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="account-order-table-box">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Discount</th>
                <th>Min order</th>
                <th>Scope</th>
                <th>Valid until</th>
                <th>Eligibility</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.voucherId}>
                  <td>
                    <strong>{item.code}</strong>
                  </td>
                  <td>
                    <div>{item.name}</div>
                    {item.shopName ? (
                      <div className="account-muted">{item.shopName}</div>
                    ) : null}
                  </td>
                  <td>{formatDiscount(item)}</td>
                  <td>{formatMoney(item.minOrderAmount, 'VND')}</td>
                  <td>{item.scope}</td>
                  <td>{formatDate(item.endsAt)}</td>
                  <td>
                    {item.isEligible ? (
                      <span className="buyer-order-status buyer-order-status--completed">Eligible</span>
                    ) : (
                      <span className="buyer-order-status buyer-order-status--pending">
                        {item.ineligibilityReason || 'Not eligible'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
