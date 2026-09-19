import { validateMaxLength, validateRequired } from './validators';

export const RETURN_MAX_REASON = 500;
export const RETURN_MAX_DESCRIPTION = 2000;
export const RETURN_MAX_MEDIA_URL = 512;
export const RETURN_MAX_ADMIN_NOTE = 500;
export const RETURN_MAX_STATUS_NOTE = 300;
export const RETURN_MAX_BANK_BIN = 20;
export const RETURN_MAX_BANK_ACCOUNT = 30;

const ABSOLUTE_HTTP_URL = /^https?:\/\/.+/i;

export const RETURN_ELIGIBLE_ORDER_STATUSES = new Set([
  'Shipping',
  'Delivered',
  'Completed',
]);

export type BuyerReturnFormValues = {
  reason: string;
  description: string;
  resolutionType: 'ReturnRefund' | 'Exchange';
  unboxingUrl: string;
  testingUrl: string;
  refundAccountNumber: string;
  refundAccountName: string;
};

export function canRequestReturn(orderStatus: string | null | undefined): boolean {
  if (!orderStatus) return false;
  return RETURN_ELIGIBLE_ORDER_STATUSES.has(orderStatus);
}

export function validateReturnReason(value: string): string {
  const trimmed = validateRequired(value, 'Reason');
  return validateMaxLength(trimmed, RETURN_MAX_REASON, 'Reason');
}

export function validateReturnDescription(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return validateMaxLength(trimmed, RETURN_MAX_DESCRIPTION, 'Description');
}

export function validateResolutionType(value: string): string {
  const trimmed = validateRequired(value, 'Resolution type');
  if (trimmed !== 'ReturnRefund' && trimmed !== 'Exchange') {
    throw new Error('Resolution type must be Return & refund or Exchange.');
  }
  return trimmed;
}

export function validateEvidenceMediaUrl(value: string, fieldLabel: string): string {
  const trimmed = validateRequired(value, fieldLabel);
  validateMaxLength(trimmed, RETURN_MAX_MEDIA_URL, fieldLabel);
  if (!ABSOLUTE_HTTP_URL.test(trimmed)) {
    throw new Error(`${fieldLabel} must be an absolute http or https URL.`);
  }
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
  } catch {
    throw new Error(`${fieldLabel} is not a valid URL.`);
  }
  return trimmed;
}

export function validateBuyerReturnForm(values: BuyerReturnFormValues): void {
  validateReturnReason(values.reason);
  validateReturnDescription(values.description);
  validateResolutionType(values.resolutionType);
  validateEvidenceMediaUrl(values.unboxingUrl, 'Unboxing video URL');
  validateEvidenceMediaUrl(values.testingUrl, 'Testing video URL');
}

export function validateRefundBank(selected: boolean): void {
  if (!selected) throw new Error('Please select a bank.');
}

export function validateRefundAccountNumber(value: string): string {
  const trimmed = validateRequired(value, 'Account number');
  return validateMaxLength(trimmed, RETURN_MAX_BANK_ACCOUNT, 'Account number');
}

export function validateRefundAccountName(value: string): string {
  const trimmed = validateRequired(value, 'Account holder name');
  return validateMaxLength(trimmed, 200, 'Account holder name');
}

export function canSubmitBuyerReturnForm(
  values: BuyerReturnFormValues,
  dirty: boolean,
  errors: Partial<Record<keyof BuyerReturnFormValues | 'refundBank', string | undefined>>,
): boolean {
  if (!dirty) return false;
  if (
    errors.reason ||
    errors.description ||
    errors.resolutionType ||
    errors.unboxingUrl ||
    errors.testingUrl ||
    errors.refundBank ||
    errors.refundAccountNumber ||
    errors.refundAccountName
  ) {
    return false;
  }
  if (
    !values.reason.trim() ||
    !values.resolutionType ||
    !values.unboxingUrl.trim() ||
    !values.testingUrl.trim() ||
    !values.refundAccountNumber.trim() ||
    !values.refundAccountName.trim()
  ) {
    return false;
  }
  return true;
}

export function validateReturnRejectNote(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Admin note is required when rejecting a return request.');
  }
  if (trimmed.length > RETURN_MAX_ADMIN_NOTE) {
    throw new Error(`Admin note must not exceed ${RETURN_MAX_ADMIN_NOTE} characters.`);
  }
}

export function validateReturnStatusNote(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return validateMaxLength(trimmed, RETURN_MAX_STATUS_NOTE, 'Note');
}

export function validateOptionalBankBin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return validateMaxLength(trimmed, RETURN_MAX_BANK_BIN, 'Bank BIN');
}

export function validateOptionalBankAccount(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return validateMaxLength(trimmed, RETURN_MAX_BANK_ACCOUNT, 'Bank account number');
}

/** Next admin pipeline status after seller accepts goods. */
export function nextReturnStatus(
  current: string | null | undefined,
  resolutionType?: string | null,
): string | null {
  if (!current) return null;
  if (current === 'Accepted') {
    return resolutionType === 'Exchange' ? 'Exchanged' : 'Refunded';
  }
  if (current === 'Refunded' || current === 'Exchanged') return 'Closed';
  return null;
}

/** @deprecated Prefer nextReturnStatus(current, resolutionType). */
export const RETURN_STATUS_TRANSITIONS: Record<string, string> = {
  Accepted: 'Refunded',
  Refunded: 'Closed',
  Exchanged: 'Closed',
};
