import { adminBadgeClass } from './adminBadge';

export const SELLER_WALLET_TX_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'SettlementHold', label: 'Settlement held' },
  { value: 'CommissionFee', label: 'Platform fee' },
  { value: 'SettlementRelease', label: 'Settlement released' },
  { value: 'Payout', label: 'Payout' },
  { value: 'SettlementReversal', label: 'Settlement reversed' },
  { value: 'RefundDebit', label: 'Refund debit' },
  { value: 'Adjustment', label: 'Adjustment' },
  { value: 'OrderCredit', label: 'Order credit (legacy)' },
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
    case 'SettlementHold':
      return 'Settlement held';
    case 'CommissionFee':
      return 'Platform fee';
    case 'SettlementRelease':
      return 'Settlement released';
    case 'Payout':
      return 'Payout';
    case 'SettlementReversal':
      return 'Settlement reversed';
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
    case 'SettlementHold':
      return adminBadgeClass.outlineWarning;
    case 'CommissionFee':
      return adminBadgeClass.outlineSecondary;
    case 'SettlementRelease':
      return adminBadgeClass.outlineSuccess;
    case 'Payout':
      return adminBadgeClass.solidSuccess;
    case 'SettlementReversal':
      return adminBadgeClass.outlineDanger;
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

export const SETTLEMENT_STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'Holding', label: 'Holding' },
  { value: 'OnHold', label: 'On hold' },
  { value: 'Eligible', label: 'Eligible' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Reversed', label: 'Reversed' },
] as const;

export function formatSettlementStatus(status: string): string {
  return status === 'OnHold' ? 'On hold' : status;
}

export function settlementStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Holding':
      return adminBadgeClass.outlineWarning;
    case 'OnHold':
      return adminBadgeClass.outlineDanger;
    case 'Eligible':
      return adminBadgeClass.outlinePrimary;
    case 'Approved':
      return adminBadgeClass.outlineSuccess;
    case 'Paid':
      return adminBadgeClass.solidSuccess;
    case 'Reversed':
      return adminBadgeClass.outlineSecondary;
    default:
      return adminBadgeClass.solidLight;
  }
}

export function payoutBatchBadgeClass(status: string): string {
  switch (status) {
    case 'Draft':
      return adminBadgeClass.outlineSecondary;
    case 'Approved':
      return adminBadgeClass.outlinePrimary;
    case 'Processing':
      return adminBadgeClass.outlineWarning;
    case 'Paid':
      return adminBadgeClass.solidSuccess;
    case 'Failed':
      return adminBadgeClass.outlineDanger;
    default:
      return adminBadgeClass.solidLight;
  }
}

export function bankStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Verified':
      return adminBadgeClass.solidSuccess;
    case 'Rejected':
      return adminBadgeClass.outlineDanger;
    default:
      return adminBadgeClass.outlineWarning;
  }
}
