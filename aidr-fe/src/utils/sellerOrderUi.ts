import { adminBadgeClass } from './adminBadge';
import { BUYER_ORDER_STATUS_FILTERS, formatOrderStatus } from './orderUi';

export { formatShipmentStatus } from './shipmentUi';

export const SELLER_ORDER_STATUS_FILTERS = BUYER_ORDER_STATUS_FILTERS;

export const MAX_TRACKING_CODE_LENGTH = 100;
export const MAX_SELLER_NOTE_LENGTH = 500;
export const MAX_STATUS_NOTE_LENGTH = 300;

export function sellerOrderStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'Paid':
    case 'Completed':
      return adminBadgeClass.solidSuccess;
    case 'Confirmed':
    case 'Shipping':
      return adminBadgeClass.outlineWarning;
    case 'Delivered':
      return adminBadgeClass.outlineSuccess;
    case 'Cancelled':
    case 'Returned':
      return adminBadgeClass.outlineDanger;
    case 'PendingPayment':
    case 'ReturnRequested':
      return adminBadgeClass.outlineSecondary;
    default:
      return adminBadgeClass.solidLight;
  }
}

export function shipmentStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'Delivered':
      return adminBadgeClass.solidSuccess;
    case 'PickedUp':
    case 'InTransit':
      return adminBadgeClass.outlineWarning;
    case 'Created':
      return adminBadgeClass.outlineSuccess;
    case 'Failed':
    case 'Returned':
    case 'Cancelled':
      return adminBadgeClass.outlineDanger;
    case 'Pending':
      return adminBadgeClass.outlineSecondary;
    default:
      return adminBadgeClass.solidLight;
  }
}


export function sellerOrderUpdateActionLabel(nextStatus: string | null | undefined): string {
  switch (nextStatus) {
    case 'Confirmed':
      return 'Mark as Confirmed';
    case 'Shipping':
      return 'Mark as Shipping';
    case 'Delivered':
      return 'Mark as Delivered';
    default:
      return 'Update status';
  }
}

export { formatOrderStatus };
