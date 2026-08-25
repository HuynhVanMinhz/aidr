import {
  MAX_SELLER_NOTE_LENGTH,
  MAX_STATUS_NOTE_LENGTH,
  MAX_TRACKING_CODE_LENGTH,
} from './sellerOrderUi';

export type SellerOrderUpdateFormValues = {
  trackingCode: string;
  sellerNote: string;
  note: string;
};

export type SellerOrderUpdateFieldErrors = Partial<
  Record<keyof SellerOrderUpdateFormValues, string>
>;

export function validateSellerOrderUpdate(
  values: SellerOrderUpdateFormValues,
  options: { nextStatus: string; existingTrackingCode?: string | null },
): SellerOrderUpdateFieldErrors {
  const errors: SellerOrderUpdateFieldErrors = {};
  const tracking = values.trackingCode.trim();
  const sellerNote = values.sellerNote.trim();
  const note = values.note.trim();

  if (tracking.length > MAX_TRACKING_CODE_LENGTH) {
    errors.trackingCode = `Tracking code must not exceed ${MAX_TRACKING_CODE_LENGTH} characters.`;
  }

  if (
    options.nextStatus === 'Shipping' &&
    !tracking &&
    !options.existingTrackingCode?.trim()
  ) {
    errors.trackingCode = 'Tracking code is required when marking an order as Shipping.';
  }

  if (sellerNote.length > MAX_SELLER_NOTE_LENGTH) {
    errors.sellerNote = `Seller note must not exceed ${MAX_SELLER_NOTE_LENGTH} characters.`;
  }

  if (note.length > MAX_STATUS_NOTE_LENGTH) {
    errors.note = `Status note must not exceed ${MAX_STATUS_NOTE_LENGTH} characters.`;
  }

  return errors;
}

export function canSubmitSellerOrderUpdate(
  values: SellerOrderUpdateFormValues,
  options: {
    nextStatus: string;
    existingTrackingCode?: string | null;
    dirty: boolean;
    errors: SellerOrderUpdateFieldErrors;
  },
): boolean {
  if (!options.dirty) return false;
  if (Object.keys(options.errors).length > 0) return false;

  if (
    options.nextStatus === 'Shipping' &&
    !values.trackingCode.trim() &&
    !options.existingTrackingCode?.trim()
  ) {
    return false;
  }

  return Boolean(options.nextStatus);
}
