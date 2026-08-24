import { adminBadgeClass } from './adminBadge';

/** Format VND amounts for seller product UI. */
export function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export function sellerProductStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Approved':
      return adminBadgeClass.solidSuccess;
    case 'Pending':
      return adminBadgeClass.outlineWarning;
    case 'Rejected':
    case 'Deleted':
      return adminBadgeClass.outlineDanger;
    case 'Draft':
      return adminBadgeClass.outlineSecondary;
    case 'Inactive':
      return adminBadgeClass.solidLight;
    default:
      return adminBadgeClass.solidLight;
  }
}
