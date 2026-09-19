import { adminBadgeClass } from './adminBadge';
import { parseUtcDate } from './dateUtc';
import { formatReportPeriodLabel, SELLER_REPORT_GRANULARITY_OPTIONS } from './sellerFinanceUi';

export const ADMIN_ACCOUNT_STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Locked', label: 'Locked' },
  { value: 'PendingDeletion', label: 'Pending deletion' },
] as const;

export const ADMIN_ACCOUNT_ROLE_FILTERS = [
  { value: 'all', label: 'All roles' },
  { value: 'BUYER', label: 'Buyer' },
  { value: 'SELLER', label: 'Seller' },
  { value: 'ADMIN', label: 'Admin' },
] as const;

export const ADMIN_INSIGHT_GRANULARITY_OPTIONS = SELLER_REPORT_GRANULARITY_OPTIONS;

export function accountStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Active':
      return adminBadgeClass.solidSuccess;
    case 'Locked':
      return adminBadgeClass.outlineDanger;
    case 'PendingDeletion':
      return adminBadgeClass.outlineWarning;
    default:
      return adminBadgeClass.solidLight;
  }
}

export function formatAccountRole(role: string): string {
  switch (role.toUpperCase()) {
    case 'BUYER':
      return 'Buyer';
    case 'SELLER':
      return 'Seller';
    case 'ADMIN':
      return 'Admin';
    default:
      return role;
  }
}

export function formatInsightPeriodLabel(periodKey: string, granularity: string): string {
  return formatReportPeriodLabel(periodKey, granularity);
}

export function formatAccountDateTime(value?: string | null): string {
  if (!value) return 'Not available';
  const date = parseUtcDate(value);
  if (!date) return 'Not available';
  return date.toLocaleString();
}

export function formatLastLoginAt(value?: string | null): string {
  if (!value) return 'Never logged in';
  const date = parseUtcDate(value);
  if (!date) return 'Never logged in';
  return date.toLocaleString();
}

export function formatLockoutUntil(value?: string | null): string {
  if (!value) return 'No temporary lockout';
  const date = parseUtcDate(value);
  if (!date) return 'No temporary lockout';
  return date.toLocaleString();
}

export function formatOptionalText(value?: string | null, emptyLabel = 'Not provided'): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : emptyLabel;
}

export function accountHasAdminRole(roles: string[]): boolean {
  return roles.some((r) => r.toUpperCase() === 'ADMIN');
}

export function canLockAccount(params: {
  accountUserId: string;
  currentUserId?: string | null;
  status: string;
  roles: string[];
}): boolean {
  if (!params.currentUserId) return false;
  if (params.accountUserId === params.currentUserId) return false;
  if (accountHasAdminRole(params.roles)) return false;
  return params.status === 'Active';
}

export function canUnlockAccount(status: string): boolean {
  return status === 'Locked';
}
