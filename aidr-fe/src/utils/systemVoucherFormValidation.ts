import type { FieldErrors } from './formValidation';
import { tryValidateField } from './formValidation';
import { validateMaxLength, validateRequired } from './validators';
import {
  VOUCHER_MAX_CODE,
  VOUCHER_MAX_DESCRIPTION,
  VOUCHER_MAX_NAME,
  VOUCHER_MAX_PER_USER,
  VOUCHER_MIN_PER_USER,
  type SystemVoucherFormValues,
} from '../components/admin/systemVoucherFormConstants';

export type SystemVoucherFormField =
  | 'code'
  | 'name'
  | 'description'
  | 'discountType'
  | 'discountValue'
  | 'maxDiscountAmount'
  | 'minOrderAmount'
  | 'usageLimit'
  | 'perUserLimit'
  | 'startsAt'
  | 'endsAt';

export function validateSystemVoucherFormFields(
  form: SystemVoucherFormValues,
  mode: 'create' | 'edit',
): FieldErrors<SystemVoucherFormField> {
  const errors: FieldErrors<SystemVoucherFormField> = {};

  if (mode === 'create') {
    const codeError = tryValidateField(() => {
      const code = validateMaxLength(
        validateRequired(form.code, 'Voucher code'),
        VOUCHER_MAX_CODE,
        'Voucher code',
      ).toUpperCase();
      if (!/^[A-Z0-9_-]+$/.test(code)) {
        throw new Error('Voucher code may only contain letters, digits, hyphen, and underscore.');
      }
    });
    if (codeError) errors.code = codeError;
  }

  const nameError = tryValidateField(() =>
    validateMaxLength(validateRequired(form.name, 'Voucher name'), VOUCHER_MAX_NAME, 'Voucher name'),
  );
  if (nameError) errors.name = nameError;

  if (form.description.trim()) {
    const descriptionError = tryValidateField(() =>
      validateMaxLength(form.description.trim(), VOUCHER_MAX_DESCRIPTION, 'Description'),
    );
    if (descriptionError) errors.description = descriptionError;
  }

  if (form.discountType !== 'Percent' && form.discountType !== 'FixedAmount') {
    errors.discountType = 'Discount type must be Percent or FixedAmount.';
  }

  const discountValueError = tryValidateField(() => {
    const raw = form.discountValue.trim();
    if (!raw) throw new Error('Discount value is required.');
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Discount value must be greater than 0.');
    if (form.discountType === 'Percent' && value > 100) {
      throw new Error('Percent discount must not exceed 100.');
    }
  });
  if (discountValueError) errors.discountValue = discountValueError;

  if (form.maxDiscountAmount.trim()) {
    const maxError = tryValidateField(() => {
      const value = Number(form.maxDiscountAmount.trim());
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Max discount amount must be greater than 0 when provided.');
      }
    });
    if (maxError) errors.maxDiscountAmount = maxError;
  }

  const minOrderError = tryValidateField(() => {
    const raw = form.minOrderAmount.trim();
    if (!raw) throw new Error('Minimum order amount is required.');
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Minimum order amount cannot be negative.');
    }
  });
  if (minOrderError) errors.minOrderAmount = minOrderError;

  if (form.usageLimit.trim()) {
    const usageError = tryValidateField(() => {
      const value = Number(form.usageLimit.trim());
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('Usage limit must be a positive integer when provided.');
      }
    });
    if (usageError) errors.usageLimit = usageError;
  }

  const perUserError = tryValidateField(() => {
    const raw = form.perUserLimit.trim();
    if (!raw) throw new Error('Per-user limit is required.');
    const value = Number(raw);
    if (!Number.isInteger(value) || value < VOUCHER_MIN_PER_USER || value > VOUCHER_MAX_PER_USER) {
      throw new Error(
        `Per-user limit must be between ${VOUCHER_MIN_PER_USER} and ${VOUCHER_MAX_PER_USER}.`,
      );
    }
  });
  if (perUserError) errors.perUserLimit = perUserError;

  const startsError = tryValidateField(() => {
    if (!form.startsAt.trim()) throw new Error('Start date is required.');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.startsAt.trim())) {
      throw new Error('Start date is invalid.');
    }
  });
  if (startsError) errors.startsAt = startsError;

  const endsError = tryValidateField(() => {
    if (!form.endsAt.trim()) throw new Error('End date is required.');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.endsAt.trim())) {
      throw new Error('End date is invalid.');
    }
    const start = new Date(form.startsAt);
    const end = new Date(form.endsAt);
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end.getTime() <= start.getTime()
    ) {
      throw new Error('End date must be after start date.');
    }
  });
  if (endsError) errors.endsAt = endsError;

  return errors;
}

export function isSystemVoucherFormDirty(
  form: SystemVoucherFormValues,
  initial: SystemVoucherFormValues,
  mode: 'create' | 'edit',
): boolean {
  if (mode === 'create') {
    return (
      form.code.trim() !== '' ||
      form.name.trim() !== '' ||
      form.description.trim() !== '' ||
      form.discountValue.trim() !== '10' ||
      form.maxDiscountAmount.trim() !== '' ||
      form.minOrderAmount.trim() !== '0' ||
      form.usageLimit.trim() !== '' ||
      form.perUserLimit.trim() !== '1' ||
      form.discountType !== 'Percent' ||
      !form.isActive
    );
  }

  return (
    form.name !== initial.name ||
    form.description !== initial.description ||
    form.discountType !== initial.discountType ||
    form.discountValue !== initial.discountValue ||
    form.maxDiscountAmount !== initial.maxDiscountAmount ||
    form.minOrderAmount !== initial.minOrderAmount ||
    form.usageLimit !== initial.usageLimit ||
    form.perUserLimit !== initial.perUserLimit ||
    form.startsAt !== initial.startsAt ||
    form.endsAt !== initial.endsAt
  );
}

export function canSubmitSystemVoucherForm(
  form: SystemVoucherFormValues,
  initial: SystemVoucherFormValues,
  mode: 'create' | 'edit',
  errors: FieldErrors<SystemVoucherFormField>,
): boolean {
  if (Object.keys(errors).length > 0) return false;
  if (mode === 'create') {
    return Boolean(form.code.trim() && form.name.trim() && form.discountValue.trim());
  }
  return isSystemVoucherFormDirty(form, initial, mode);
}
