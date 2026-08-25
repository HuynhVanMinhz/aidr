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
  unboxingUrl: string;
  testingUrl: string;
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
  validateEvidenceMediaUrl(values.unboxingUrl, 'Unboxing video URL');
  validateEvidenceMediaUrl(values.testingUrl, 'Testing video URL');
}

export function canSubmitBuyerReturnForm(
  values: BuyerReturnFormValues,
  dirty: boolean,
  errors: Partial<Record<keyof BuyerReturnFormValues, string | undefined>>,
): boolean {
  if (!dirty) return false;
  if (errors.reason || errors.description || errors.unboxingUrl || errors.testingUrl) {
    return false;
  }
  if (!values.reason.trim() || !values.unboxingUrl.trim() || !values.testingUrl.trim()) {
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

/** Next pipeline status after approve path. */
export const RETURN_STATUS_TRANSITIONS: Record<string, string> = {
  Approved: 'Receiving',
  Receiving: 'Refunded',
  Refunded: 'Closed',
};

export function nextReturnStatus(current: string | null | undefined): string | null {
  if (!current) return null;
  return RETURN_STATUS_TRANSITIONS[current] ?? null;
}
