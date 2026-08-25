import { adminBadgeClass } from './adminBadge';

export const SELLER_WALLET_TX_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'OrderCredit', label: 'Order credit' },
  { value: 'RefundDebit', label: 'Refund debit' },
  { value: 'Withdrawal', label: 'Withdrawal' },
  { value: 'Adjustment', label: 'Adjustment' },
] as const;

export const SELLER_REPORT_GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
] as const;

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function formatWalletTxType(txType: string): string {
  switch (txType) {
    case 'OrderCredit':
      return 'Order credit';
    case 'RefundDebit':
      return 'Refund debit';
    case 'Withdrawal':
      return 'Withdrawal';
    case 'Adjustment':
      return 'Adjustment';
    default:
      return txType;
  }
}

export function walletTxTypeBadgeClass(txType: string): string {
  switch (txType) {
    case 'OrderCredit':
      return adminBadgeClass.solidSuccess;
    case 'RefundDebit':
      return adminBadgeClass.outlineDanger;
    case 'Withdrawal':
      return adminBadgeClass.outlineWarning;
    case 'Adjustment':
      return adminBadgeClass.outlinePrimary;
    default:
      return adminBadgeClass.solidLight;
  }
}

export function formatReportPeriodLabel(periodKey: string, granularity: string): string {
  if (granularity === 'month') return periodKey;
  if (granularity === 'week') return periodKey.replace('-W', ' W');
  return periodKey;
}

export function defaultReportDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    from: toIsoDate(from),
    to: toIsoDate(to),
  };
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
