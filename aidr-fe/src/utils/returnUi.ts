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

export function buyerReturnStatusClass(status: string | null | undefined): string {
  const key = (status ?? '').toLowerCase();
  if (key === 'pending') return 'buyer-order-status buyer-order-status--pending';
  if (key === 'approved' || key === 'receiving') {
    return 'buyer-order-status buyer-order-status--progress';
  }
  if (key === 'refunded' || key === 'closed') {
    return 'buyer-order-status buyer-order-status--completed';
  }
  if (key === 'rejected') return 'buyer-order-status buyer-order-status--cancelled';
  return 'buyer-order-status';
}
