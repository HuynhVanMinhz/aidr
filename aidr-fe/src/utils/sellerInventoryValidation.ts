import type { FieldErrors } from './formValidation';
import { tryValidateField } from './formValidation';
import { validateMaxLength, validateRequired } from './validators';
import type {
  AdjustSellerInventoryPayload,
  ImportStockLotPayload,
  UpdateSellerInventoryPayload,
  UpdateSellingPricePayload,
} from '../types/sellerInventory';

export const SELLER_INV_MAX_LOT_CODE = 40;
export const SELLER_INV_MAX_SUPPLIER = 150;
export const SELLER_INV_MAX_INVOICE = 80;
export const SELLER_INV_MAX_LOT_NOTE = 500;
export const SELLER_INV_MAX_TX_NOTE = 300;
export const SELLER_INV_MAX_PRICE_REASON = 300;
export const SELLER_INV_MAX_QTY = 1_000_000;
export const SELLER_INV_MAX_THRESHOLD = 100_000;
export const SELLER_INV_MAX_MONEY = 999_999_999_999.99;

export type ImportLotFormValues = {
  variantId: string;
  lotCode: string;
  quantity: string;
  unitCost: string;
  supplierName: string;
  invoiceNumber: string;
  receivedAt: string;
  expiresAt: string;
  note: string;
};

export type AdjustInventoryFormValues = {
  mode: 'increase' | 'decrease-fifo' | 'decrease-lot';
  quantity: string;
  variantId: string;
  lotId: string;
  note: string;
};

export type SellingPriceFormValues = {
  basePrice: string;
  salePrice: string;
  reason: string;
};

export type LowStockFormValues = {
  lowStockThreshold: string;
};

export type ImportLotField = keyof ImportLotFormValues;
export type AdjustInventoryField = keyof AdjustInventoryFormValues;
export type SellingPriceField = keyof SellingPriceFormValues;
export type LowStockField = keyof LowStockFormValues;

export const emptyImportLotForm = (): ImportLotFormValues => ({
  variantId: '',
  lotCode: '',
  quantity: '',
  unitCost: '',
  supplierName: '',
  invoiceNumber: '',
  receivedAt: '',
  expiresAt: '',
  note: '',
});

export const emptyAdjustForm = (): AdjustInventoryFormValues => ({
  mode: 'decrease-fifo',
  quantity: '',
  variantId: '',
  lotId: '',
  note: '',
});

function parsePositiveInt(raw: string, fieldLabel: string, max: number): number {
  const trimmed = validateRequired(raw, fieldLabel);
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldLabel} must be a positive whole number.`);
  }
  if (value > max) {
    throw new Error(`${fieldLabel} must not exceed ${max}.`);
  }
  return value;
}

function parseMoney(raw: string, fieldLabel: string, required: boolean): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (required) throw new Error(`${fieldLabel} is required.`);
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error(`${fieldLabel} is invalid.`);
  if (value < 0) throw new Error(`${fieldLabel} must be greater than or equal to 0.`);
  if (value > SELLER_INV_MAX_MONEY) throw new Error(`${fieldLabel} is too large.`);
  return value;
}

function optionalBounded(raw: string, fieldLabel: string, maxLength: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  validateMaxLength(trimmed, maxLength, fieldLabel);
  return trimmed;
}

function optionalDateIso(raw: string, fieldLabel: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldLabel} is invalid.`);
  return date.toISOString();
}

export function validateImportLotForm(
  form: ImportLotFormValues,
  /** True when the product is sold in variants; stock then has to name one. */
  requireVariant = false,
): FieldErrors<ImportLotField> {
  const errors: FieldErrors<ImportLotField> = {};

  if (requireVariant && !form.variantId.trim()) {
    errors.variantId = 'Choose which variant this stock is for.';
  }

  const quantityError = tryValidateField(() =>
    parsePositiveInt(form.quantity, 'Quantity', SELLER_INV_MAX_QTY),
  );
  if (quantityError) errors.quantity = quantityError;

  const unitCostError = tryValidateField(() => parseMoney(form.unitCost, 'Unit cost', true));
  if (unitCostError) errors.unitCost = unitCostError;

  const lotCodeError = tryValidateField(() => {
    const code = optionalBounded(form.lotCode, 'Lot code', SELLER_INV_MAX_LOT_CODE);
    if (code && !/^[A-Za-z0-9_-]+$/.test(code)) {
      throw new Error('Lot code may contain only letters, numbers, hyphen, and underscore.');
    }
  });
  if (lotCodeError) errors.lotCode = lotCodeError;

  const supplierError = tryValidateField(() =>
    optionalBounded(form.supplierName, 'Supplier name', SELLER_INV_MAX_SUPPLIER),
  );
  if (supplierError) errors.supplierName = supplierError;

  const invoiceError = tryValidateField(() =>
    optionalBounded(form.invoiceNumber, 'Invoice number', SELLER_INV_MAX_INVOICE),
  );
  if (invoiceError) errors.invoiceNumber = invoiceError;

  const noteError = tryValidateField(() => optionalBounded(form.note, 'Note', SELLER_INV_MAX_LOT_NOTE));
  if (noteError) errors.note = noteError;

  const receivedError = tryValidateField(() => optionalDateIso(form.receivedAt, 'Received at'));
  if (receivedError) errors.receivedAt = receivedError;

  const expiresError = tryValidateField(() => {
    const expiresAt = optionalDateIso(form.expiresAt, 'Expires at');
    const receivedAt = optionalDateIso(form.receivedAt, 'Received at');
    if (expiresAt && receivedAt && new Date(expiresAt) <= new Date(receivedAt)) {
      throw new Error('Expiry date must be after the received date.');
    }
  });
  if (expiresError) errors.expiresAt = expiresError;

  return errors;
}

export function isImportLotFormDirty(form: ImportLotFormValues): boolean {
  const empty = emptyImportLotForm();
  return (Object.keys(empty) as ImportLotField[]).some((key) => form[key] !== empty[key]);
}

export function canSubmitImportLotForm(
  form: ImportLotFormValues,
  errors: FieldErrors<ImportLotField>,
): boolean {
  if (Object.keys(errors).length > 0) return false;
  if (!isImportLotFormDirty(form)) return false;
  return Boolean(form.quantity.trim() && form.unitCost.trim());
}

export function buildImportLotPayload(form: ImportLotFormValues): ImportStockLotPayload {
  return {
    variantId: form.variantId.trim() || null,
    lotCode: optionalBounded(form.lotCode, 'Lot code', SELLER_INV_MAX_LOT_CODE),
    quantity: parsePositiveInt(form.quantity, 'Quantity', SELLER_INV_MAX_QTY),
    unitCost: parseMoney(form.unitCost, 'Unit cost', true)!,
    supplierName: optionalBounded(form.supplierName, 'Supplier name', SELLER_INV_MAX_SUPPLIER),
    invoiceNumber: optionalBounded(form.invoiceNumber, 'Invoice number', SELLER_INV_MAX_INVOICE),
    receivedAt: optionalDateIso(form.receivedAt, 'Received at'),
    expiresAt: optionalDateIso(form.expiresAt, 'Expires at'),
    note: optionalBounded(form.note, 'Note', SELLER_INV_MAX_LOT_NOTE),
  };
}

export function validateAdjustForm(
  form: AdjustInventoryFormValues,
  requireVariant = false,
): FieldErrors<AdjustInventoryField> {
  const errors: FieldErrors<AdjustInventoryField> = {};

  // A named lot already belongs to one variant, so only the FIFO path needs the choice.
  const picksLot = form.mode === 'increase' || form.mode === 'decrease-lot';
  if (requireVariant && !picksLot && !form.variantId.trim()) {
    errors.variantId = 'Choose which variant to adjust.';
  }

  const quantityError = tryValidateField(() =>
    parsePositiveInt(form.quantity, 'Quantity', SELLER_INV_MAX_QTY),
  );
  if (quantityError) errors.quantity = quantityError;

  if (form.mode === 'increase' || form.mode === 'decrease-lot') {
    const lotError = tryValidateField(() => validateRequired(form.lotId, 'Lot'));
    if (lotError) errors.lotId = lotError;
  }

  const noteError = tryValidateField(() => optionalBounded(form.note, 'Note', SELLER_INV_MAX_TX_NOTE));
  if (noteError) errors.note = noteError;

  return errors;
}

export function isAdjustFormDirty(form: AdjustInventoryFormValues): boolean {
  return Boolean(form.quantity.trim() || form.lotId.trim() || form.note.trim());
}

export function canSubmitAdjustForm(
  form: AdjustInventoryFormValues,
  errors: FieldErrors<AdjustInventoryField>,
  requireVariant = false,
): boolean {
  if (Object.keys(errors).length > 0) return false;
  if (!form.quantity.trim()) return false;
  if (form.mode === 'increase' || form.mode === 'decrease-lot') {
    return Boolean(form.lotId.trim());
  }
  if (requireVariant && !form.variantId.trim()) return false;
  return true;
}

export function buildAdjustPayload(form: AdjustInventoryFormValues): AdjustSellerInventoryPayload {
  const qty = parsePositiveInt(form.quantity, 'Quantity', SELLER_INV_MAX_QTY);
  const changeQty = form.mode === 'increase' ? qty : -qty;
  const needsLot = form.mode === 'increase' || form.mode === 'decrease-lot';
  return {
    // A named lot already pins the variant, so it is only sent for the FIFO path.
    variantId: needsLot ? null : form.variantId.trim() || null,
    changeQty,
    lotId: needsLot ? form.lotId.trim() : null,
    note: optionalBounded(form.note, 'Note', SELLER_INV_MAX_TX_NOTE),
  };
}

export function validateSellingPriceForm(
  form: SellingPriceFormValues,
): FieldErrors<SellingPriceField> {
  const errors: FieldErrors<SellingPriceField> = {};

  const baseError = tryValidateField(() => parseMoney(form.basePrice, 'Base price', true));
  if (baseError) errors.basePrice = baseError;

  const saleError = tryValidateField(() => parseMoney(form.salePrice, 'Sale price', false));
  if (saleError) errors.salePrice = saleError;

  const reasonError = tryValidateField(() =>
    optionalBounded(form.reason, 'Reason', SELLER_INV_MAX_PRICE_REASON),
  );
  if (reasonError) errors.reason = reasonError;

  return errors;
}

export function isSellingPriceFormDirty(
  form: SellingPriceFormValues,
  initial: SellingPriceFormValues,
): boolean {
  return (
    form.basePrice.trim() !== initial.basePrice.trim() ||
    form.salePrice.trim() !== initial.salePrice.trim()
  );
}

export function canSubmitSellingPriceForm(
  form: SellingPriceFormValues,
  initial: SellingPriceFormValues,
  errors: FieldErrors<SellingPriceField>,
): boolean {
  if (Object.keys(errors).length > 0) return false;
  if (!isSellingPriceFormDirty(form, initial)) return false;
  return Boolean(form.basePrice.trim());
}

export function buildSellingPricePayload(form: SellingPriceFormValues): UpdateSellingPricePayload {
  return {
    basePrice: parseMoney(form.basePrice, 'Base price', true)!,
    salePrice: parseMoney(form.salePrice, 'Sale price', false),
    reason: optionalBounded(form.reason, 'Reason', SELLER_INV_MAX_PRICE_REASON),
  };
}

export function validateLowStockForm(form: LowStockFormValues): FieldErrors<LowStockField> {
  const errors: FieldErrors<LowStockField> = {};
  const thresholdError = tryValidateField(() => {
    const trimmed = validateRequired(form.lowStockThreshold, 'Low-stock threshold');
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('Low-stock threshold must be a whole number greater than or equal to 0.');
    }
    if (value > SELLER_INV_MAX_THRESHOLD) {
      throw new Error(`Low-stock threshold must not exceed ${SELLER_INV_MAX_THRESHOLD}.`);
    }
  });
  if (thresholdError) errors.lowStockThreshold = thresholdError;
  return errors;
}

export function canSubmitLowStockForm(
  form: LowStockFormValues,
  initial: LowStockFormValues,
  errors: FieldErrors<LowStockField>,
): boolean {
  if (Object.keys(errors).length > 0) return false;
  if (form.lowStockThreshold.trim() === initial.lowStockThreshold.trim()) return false;
  return Boolean(form.lowStockThreshold.trim());
}

export function buildLowStockPayload(form: LowStockFormValues): UpdateSellerInventoryPayload {
  return { lowStockThreshold: Number(form.lowStockThreshold.trim()) };
}
