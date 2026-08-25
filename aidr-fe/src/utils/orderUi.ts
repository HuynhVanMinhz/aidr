export const BUYER_ORDER_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PendingPayment', label: 'Pending payment' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Shipping', label: 'Shipping' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
] as const;

export function formatOrderStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  const map: Record<string, string> = {
    PendingPayment: 'Pending payment',
    Paid: 'Paid',
    Confirmed: 'Confirmed',
    Shipping: 'Shipping',
    Delivered: 'Delivered',
    Completed: 'Completed',
    Cancelled: 'Cancelled',
    ReturnRequested: 'Return requested',
    Returned: 'Returned',
  };
  return map[status] ?? status;
}

export function formatOrderDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatShippingLine(parts: {
  streetAddress: string;
  ward: string;
  district: string;
  province: string;
}): string {
  return [parts.streetAddress, parts.ward, parts.district, parts.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

export function orderStatusClass(status: string | null | undefined): string {
  const key = (status ?? '').toLowerCase();
  if (key === 'pendingpayment') return 'buyer-order-status buyer-order-status--pending';
  if (key === 'paid' || key === 'confirmed' || key === 'shipping') {
    return 'buyer-order-status buyer-order-status--progress';
  }
  if (key === 'delivered') return 'buyer-order-status buyer-order-status--delivered';
  if (key === 'completed') return 'buyer-order-status buyer-order-status--completed';
  if (key === 'cancelled') return 'buyer-order-status buyer-order-status--cancelled';
  return 'buyer-order-status';
}
