import { adminBadgeClass } from './adminBadge';

export function formatReturnStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  const map: Record<string, string> = {
    Pending: 'Pending',
    Approved: 'Approved (with seller)',
    Rejected: 'Rejected',
    SellerConfirmed: 'Seller confirmed',
    Receiving: 'Receiving',
    Accepted: 'Accepted',
    Refunded: 'Refunded',
    Exchanged: 'Exchanged',
    Closed: 'Closed',
  };
  return map[status] ?? status;
}

export function formatResolutionType(type: string | null | undefined): string {
  if (!type) return '—';
  if (type === 'Exchange') return 'Exchange';
  if (type === 'ReturnRefund') return 'Return & refund';
  return type;
}

export function returnStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Approved':
    case 'SellerConfirmed':
    case 'Accepted':
    case 'Refunded':
    case 'Exchanged':
    case 'Closed':
      return adminBadgeClass.solidSuccess;
    case 'Rejected':
      return adminBadgeClass.outlineDanger;
    case 'Receiving':
      return adminBadgeClass.outlinePrimary;
    case 'Pending':
      return adminBadgeClass.outlineWarning;
    default:
      return adminBadgeClass.solidLight;
  }
}

export function buyerReturnStatusClass(status: string | null | undefined): string {
  const key = (status ?? '').toLowerCase();
  if (key === 'pending') return 'buyer-order-status buyer-order-status--pending';
  if (key === 'approved' || key === 'sellerconfirmed') {
    return 'buyer-order-status buyer-order-status--completed';
  }
  if (key === 'receiving') return 'buyer-order-status buyer-order-status--progress';
  if (key === 'accepted' || key === 'refunded' || key === 'exchanged') {
    return 'buyer-order-status buyer-order-status--completed';
  }
  if (key === 'closed') return 'buyer-order-status';
  if (key === 'rejected') return 'buyer-order-status buyer-order-status--cancelled';
  return 'buyer-order-status';
}

export const RETURN_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'SellerConfirmed', label: 'Seller confirmed' },
  { value: 'Receiving', label: 'Receiving' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Exchanged', label: 'Exchanged' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Rejected', label: 'Rejected' },
] as const;

export const SELLER_RETURN_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'Approved', label: 'Needs confirmation' },
  { value: 'SellerConfirmed', label: 'Seller confirmed' },
  { value: 'Receiving', label: 'Receiving' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Exchanged', label: 'Exchanged' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Rejected', label: 'Rejected' },
] as const;

export function returnStatusIcon(status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'pending':
      return 'fa-regular fa-clock';
    case 'approved':
      return 'fa-solid fa-share-from-square';
    case 'sellerconfirmed':
      return 'fa-solid fa-handshake';
    case 'receiving':
      return 'fa-solid fa-truck-ramp-box';
    case 'accepted':
      return 'fa-solid fa-circle-check';
    case 'refunded':
      return 'fa-solid fa-money-bill-transfer';
    case 'exchanged':
      return 'fa-solid fa-arrows-rotate';
    case 'closed':
      return 'fa-solid fa-flag-checkered';
    case 'rejected':
      return 'fa-solid fa-circle-xmark';
    default:
      return 'fa-regular fa-circle';
  }
}

export function returnStatusHint(status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'pending':
      return 'We are reviewing your request and the evidence you sent. This usually takes 1–2 business days.';
    case 'approved':
      return 'Your request was approved and sent to the seller. Wait for the seller to confirm the handling plan.';
    case 'sellerconfirmed':
      return 'The seller confirmed the plan. Please ship the item back using the instructions from support or the seller.';
    case 'receiving':
      return 'The seller has marked your package as received and is inspecting it.';
    case 'accepted':
      return 'The seller accepted the returned item. AIDR support will complete your refund or exchange next.';
    case 'refunded':
      return 'The refund has been sent to your bank. It normally lands within 1–3 business days.';
    case 'exchanged':
      return 'Your exchange has been completed. The seller will send the replacement item.';
    case 'closed':
      return 'This return is finished. Nothing more is needed from you.';
    case 'rejected':
      return 'This request was declined. See the note below, or contact support if you disagree.';
    default:
      return '';
  }
}

export const RETURN_TIMELINE_STAGES = [
  'Pending',
  'Approved',
  'SellerConfirmed',
  'Receiving',
  'Accepted',
  'Refunded',
  'Closed',
] as const;

export function returnTimelineStages(resolutionType?: string | null): readonly string[] {
  if (resolutionType === 'Exchange') {
    return ['Pending', 'Approved', 'SellerConfirmed', 'Receiving', 'Accepted', 'Exchanged', 'Closed'];
  }
  return RETURN_TIMELINE_STAGES;
}

export function returnHistoryActor(fromStatus: string | null | undefined): string {
  if (!fromStatus) return 'You';
  if (fromStatus === 'Pending') return 'AIDR support';
  if (fromStatus === 'Approved' || fromStatus === 'SellerConfirmed' || fromStatus === 'Receiving') {
    return 'Seller';
  }
  return 'AIDR support';
}
