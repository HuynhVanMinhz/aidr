import type { FieldErrors } from './formValidation';
import { tryValidateField } from './formValidation';
import {
  validateMaxLength,
  validateRequired,
  validateSlug,
} from './validators';
import {
  SELLER_PRODUCT_CONDITIONS,
  SELLER_PRODUCT_MAX_BRAND,
  SELLER_PRODUCT_MAX_MODEL,
  SELLER_PRODUCT_MAX_NAME,
  SELLER_PRODUCT_MAX_ORIGIN,
  SELLER_PRODUCT_MAX_SHORT_DESCRIPTION,
  SELLER_PRODUCT_MAX_SLUG,
  SELLER_PRODUCT_MAX_SPECS_JSON,
  SELLER_PRODUCT_MAX_TAGS_JSON,
  type SellerProductFormValues,
  type SellerProductStagedImage,
} from '../components/seller/sellerProductFormConstants';

export type SellerProductFormField =
  | 'categoryId'
  | 'name'
  | 'slug'
  | 'shortDescription'
  | 'description'
  | 'brand'
  | 'modelNumber'
  | 'conditionType'
  | 'basePrice'
  | 'salePrice'
  | 'warrantyMonths'
  | 'originCountry'
  | 'tagsJson'
  | 'specsJson'
  | 'images';

function optionalTrimmed(
  value: string,
  maxLength: number,
  fieldLabel: string,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  validateMaxLength(trimmed, maxLength, fieldLabel);
  return trimmed;
}

function validateOptionalJson(value: string, maxLength: number, fieldLabel: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  validateMaxLength(trimmed, maxLength, fieldLabel);
  try {
    JSON.parse(trimmed);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }
}

export function validateSellerProductFormFields(
  form: SellerProductFormValues,
  images: SellerProductStagedImage[],
  options?: { requireImages?: boolean },
): FieldErrors<SellerProductFormField> {
  const errors: FieldErrors<SellerProductFormField> = {};
  const requireImages = options?.requireImages ?? false;

  const categoryError = tryValidateField(() => {
    const raw = form.categoryId.trim();
    if (!raw) throw new Error('Category is required.');
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Category is invalid.');
  });
  if (categoryError) errors.categoryId = categoryError;

  const nameError = tryValidateField(() =>
    validateMaxLength(validateRequired(form.name, 'Product name'), SELLER_PRODUCT_MAX_NAME, 'Product name'),
  );
  if (nameError) errors.name = nameError;

  const slugError = tryValidateField(() => validateSlug(form.slug, SELLER_PRODUCT_MAX_SLUG));
  if (slugError) errors.slug = slugError;

  const shortError = tryValidateField(() =>
    optionalTrimmed(form.shortDescription, SELLER_PRODUCT_MAX_SHORT_DESCRIPTION, 'Short description'),
  );
  if (shortError) errors.shortDescription = shortError;

  const brandError = tryValidateField(() =>
    optionalTrimmed(form.brand, SELLER_PRODUCT_MAX_BRAND, 'Brand'),
  );
  if (brandError) errors.brand = brandError;

  const modelError = tryValidateField(() =>
    optionalTrimmed(form.modelNumber, SELLER_PRODUCT_MAX_MODEL, 'Model number'),
  );
  if (modelError) errors.modelNumber = modelError;

  const conditionError = tryValidateField(() => {
    const value = validateRequired(form.conditionType, 'Condition');
    if (!SELLER_PRODUCT_CONDITIONS.includes(value as (typeof SELLER_PRODUCT_CONDITIONS)[number])) {
      throw new Error('Condition must be New, LikeNew, Refurbished, or Used.');
    }
  });
  if (conditionError) errors.conditionType = conditionError;

  const basePriceError = tryValidateField(() => {
    const raw = validateRequired(form.basePrice, 'Base price');
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error('Base price must be greater than or equal to 0.');
    }
  });
  if (basePriceError) errors.basePrice = basePriceError;

  const salePriceError = tryValidateField(() => {
    const raw = form.salePrice.trim();
    if (!raw) return;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error('Sale price must be greater than or equal to 0.');
    }
  });
  if (salePriceError) errors.salePrice = salePriceError;

  const warrantyError = tryValidateField(() => {
    const raw = form.warrantyMonths.trim();
    if (!raw) return;
    const months = Number(raw);
    if (!Number.isInteger(months) || months < 0 || months > 1200) {
      throw new Error('Warranty months must be an integer between 0 and 1200.');
    }
  });
  if (warrantyError) errors.warrantyMonths = warrantyError;

  const originError = tryValidateField(() =>
    optionalTrimmed(form.originCountry, SELLER_PRODUCT_MAX_ORIGIN, 'Origin country'),
  );
  if (originError) errors.originCountry = originError;

  const tagsError = tryValidateField(() =>
    validateOptionalJson(form.tagsJson, SELLER_PRODUCT_MAX_TAGS_JSON, 'Tags JSON'),
  );
  if (tagsError) errors.tagsJson = tagsError;

  const specsError = tryValidateField(() =>
    validateOptionalJson(form.specsJson, SELLER_PRODUCT_MAX_SPECS_JSON, 'Specs JSON'),
  );
  if (specsError) errors.specsJson = specsError;

  if (requireImages && images.length === 0) {
    errors.images = 'At least one product image is required.';
  } else if (images.filter((i) => i.isPrimary).length > 1) {
    errors.images = 'Only one image can be marked as primary.';
  }

  return errors;
}

export function isSellerProductFormDirty(
  form: SellerProductFormValues,
  initial: SellerProductFormValues,
  images: SellerProductStagedImage[],
  initialImages: SellerProductStagedImage[],
  mode: 'create' | 'edit',
): boolean {
  if (mode === 'create') {
    return (
      Object.values(form).some((v) => String(v).trim() !== '' && v !== 'New') ||
      form.conditionType !== 'New' ||
      images.length > 0
    );
  }

  const formDirty = (Object.keys(form) as (keyof SellerProductFormValues)[]).some(
    (key) => form[key].trim() !== initial[key].trim(),
  );
  if (formDirty) return true;

  if (images.length !== initialImages.length) return true;
  return images.some((img, index) => {
    const prev = initialImages[index];
    return (
      !prev ||
      img.imageUrl !== prev.imageUrl ||
      img.publicId !== prev.publicId ||
      img.isPrimary !== prev.isPrimary ||
      img.sortOrder !== prev.sortOrder
    );
  });
}

export function canSubmitSellerProductForm(
  form: SellerProductFormValues,
  initial: SellerProductFormValues,
  images: SellerProductStagedImage[],
  initialImages: SellerProductStagedImage[],
  mode: 'create' | 'edit',
  errors: FieldErrors<SellerProductFormField>,
  /**
   * Stock waiting to be received counts as an unsaved change. Without this, an
   * edit that only receives a delivery leaves Save disabled, because none of the
   * product's own fields moved.
   */
  hasPendingStock = false,
  /**
   * Same for the variant grid: giving the "Pink" variant its own photo changes nothing
   * about the product's own fields, and Save has to notice it all the same.
   */
  hasVariantChanges = false,
): boolean {
  if (Object.keys(errors).length > 0) return false;
  if (
    !isSellerProductFormDirty(form, initial, images, initialImages, mode) &&
    !hasPendingStock &&
    !hasVariantChanges
  ) {
    return false;
  }
  if (mode === 'create') {
    return Boolean(
      form.name.trim() &&
        form.slug.trim() &&
        form.categoryId.trim() &&
        form.conditionType.trim() &&
        form.basePrice.trim() &&
        images.length > 0,
    );
  }
  return true;
}

export function buildSellerProductPayload(form: SellerProductFormValues) {
  const saleRaw = form.salePrice.trim();
  const warrantyRaw = form.warrantyMonths.trim();

  return {
    categoryId: Number(form.categoryId),
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    shortDescription: form.shortDescription.trim() || null,
    description: form.description.trim() || null,
    brand: form.brand.trim() || null,
    modelNumber: form.modelNumber.trim() || null,
    conditionType: form.conditionType.trim(),
    basePrice: Number(form.basePrice),
    salePrice: saleRaw ? Number(saleRaw) : null,
    warrantyMonths: warrantyRaw ? Number(warrantyRaw) : null,
    originCountry: form.originCountry.trim() || null,
    tagsJson: form.tagsJson.trim() || null,
    specsJson: form.specsJson.trim() || null,
  };
}
