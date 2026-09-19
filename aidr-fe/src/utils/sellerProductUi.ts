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

export function sellerLotStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Open':
      return adminBadgeClass.outlineSuccess;
    case 'Depleted':
      return adminBadgeClass.outlineSecondary;
    case 'Void':
      return adminBadgeClass.outlineDanger;
    default:
      return adminBadgeClass.solidLight;
  }
}

export function formatDateTime(
  value: string | null | undefined,
  emptyLabel = '-',
): string {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
