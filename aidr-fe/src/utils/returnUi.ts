import { adminBadgeClass } from './adminBadge';

export function formatReturnStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  const map: Record<string, string> = {
    Pending: 'Pending',
    Approved: 'Approved',
    Rejected: 'Rejected',
    Receiving: 'Receiving',
    Refunded: 'Refunded',
    Closed: 'Closed',
  };
  return map[status] ?? status;
}

export function returnStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Approved':
    case 'Refunded':
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

/**
 * One colour per stage: waiting = amber, approved = green, in transit = blue,
 * money back = green, finished = neutral grey, declined = red.
 */
export function buyerReturnStatusClass(status: string | null | undefined): string {
  const key = (status ?? '').toLowerCase();
  if (key === 'pending') return 'buyer-order-status buyer-order-status--pending';
  if (key === 'approved') return 'buyer-order-status buyer-order-status--completed';
  if (key === 'receiving') return 'buyer-order-status buyer-order-status--progress';
  if (key === 'refunded') return 'buyer-order-status buyer-order-status--completed';
  if (key === 'closed') return 'buyer-order-status';
  if (key === 'rejected') return 'buyer-order-status buyer-order-status--cancelled';
  return 'buyer-order-status';
}

/* ---------------------------------------------------------- buyer return UI */

export const RETURN_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Receiving', label: 'Receiving' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Rejected', label: 'Rejected' },
] as const;

/** Font Awesome glyph per status, so colour is never the only signal. */
export function returnStatusIcon(status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'pending':
      return 'fa-regular fa-clock';
    case 'approved':
      return 'fa-solid fa-circle-check';
    case 'receiving':
      return 'fa-solid fa-truck-ramp-box';
    case 'refunded':
      return 'fa-solid fa-money-bill-transfer';
    case 'closed':
      return 'fa-solid fa-flag-checkered';
    case 'rejected':
      return 'fa-solid fa-circle-xmark';
    default:
      return 'fa-regular fa-circle';
  }
}

/** Plain-language "what happens next" for the buyer. */
export function returnStatusHint(status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'pending':
      return 'We are reviewing your request and the evidence you sent. This usually takes 1–2 business days.';
    case 'approved':
      return 'Your request was approved. Send the item back using the instructions from support.';
    case 'receiving':
      return 'We are waiting for the returned item to arrive and be inspected.';
    case 'refunded':
      return 'The refund has been sent to your bank. It normally lands within 1–3 business days.';
    case 'closed':
      return 'This return is finished. Nothing more is needed from you.';
    case 'rejected':
      return 'This request was declined. See the note below, or contact support if you disagree.';
    default:
      return '';
  }
}

/** Ordered stages a return moves through, for the timeline. */
export const RETURN_TIMELINE_STAGES = ['Pending', 'Approved', 'Receiving', 'Refunded', 'Closed'] as const;

/**
 * Every transition except the first is made by support — the buyer only ever
 * creates the request. Avoids exposing admin identities.
 */
export function returnHistoryActor(fromStatus: string | null | undefined): string {
  return fromStatus ? 'AIDR support' : 'You';
}
