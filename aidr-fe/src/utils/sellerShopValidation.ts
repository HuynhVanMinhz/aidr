import { validateMaxLength, validateRequired } from './validators';
import type { UpdateSellerShopPayload } from '../types/sellerShop';

export const SELLER_SHOP_MAX_NAME = 120;
export const SELLER_SHOP_MAX_TAGLINE = 200;
export const SELLER_SHOP_MAX_SHORT_DESCRIPTION = 500;
export const SELLER_SHOP_MAX_DESCRIPTION = 5000;
export const SELLER_SHOP_MAX_POLICY = 5000;
export const SELLER_SHOP_MAX_URL = 500;
export const SELLER_SHOP_MAX_ADDRESS = 200;
export const SELLER_SHOP_MAX_PHONE = 20;
export const SELLER_SHOP_MAX_OPENING_HOURS = 2000;

/**
 * Only the text fields on the form. The pickup coordinates ride in the payload
 * but never through this form, so they are not fields the validator can index.
 */
export type SellerShopFormField = keyof SellerShopFormValues;

export type SellerShopFormValues = {
  shopName: string;
  tagline: string;
  shortDescription: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  email: string;
  phone: string;
  hotline: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  returnPolicy: string;
  shippingPolicy: string;
  websiteUrl: string;
  facebookUrl: string;
  openingHoursJson: string;
};

export function emptySellerShopForm(overrides?: Partial<SellerShopFormValues>): SellerShopFormValues {
  return {
    shopName: '',
    tagline: '',
    shortDescription: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    email: '',
    phone: '',
    hotline: '',
    province: '',
    district: '',
    ward: '',
    streetAddress: '',
    returnPolicy: '',
    shippingPolicy: '',
    websiteUrl: '',
    facebookUrl: '',
    openingHoursJson: '',
    ...overrides,
  };
}

function optionalUrl(value: string, label: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`${label} must use http or https.`);
    }
    validateMaxLength(trimmed, SELLER_SHOP_MAX_URL, label);
    return trimmed;
  } catch (error) {
    throw error instanceof Error ? error : new Error(`${label} is invalid.`);
  }
}

export function validateSellerShopForm(values: SellerShopFormValues) {
  const errors: Partial<Record<SellerShopFormField, string>> = {};

  try {
    const shopName = validateRequired(values.shopName, 'Shop name');
    validateMaxLength(shopName, SELLER_SHOP_MAX_NAME, 'Shop name');
  } catch (error) {
    errors.shopName = error instanceof Error ? error.message : 'Shop name is invalid.';
  }

  const optionalChecks: Array<[SellerShopFormField, string, number]> = [
    ['tagline', 'Tagline', SELLER_SHOP_MAX_TAGLINE],
    ['shortDescription', 'Short description', SELLER_SHOP_MAX_SHORT_DESCRIPTION],
    ['description', 'Description', SELLER_SHOP_MAX_DESCRIPTION],
    ['returnPolicy', 'Return policy', SELLER_SHOP_MAX_POLICY],
    ['shippingPolicy', 'Shipping policy', SELLER_SHOP_MAX_POLICY],
    ['province', 'Province', SELLER_SHOP_MAX_ADDRESS],
    ['district', 'District', SELLER_SHOP_MAX_ADDRESS],
    ['ward', 'Ward', SELLER_SHOP_MAX_ADDRESS],
    ['streetAddress', 'Street address', SELLER_SHOP_MAX_ADDRESS],
    ['phone', 'Phone', SELLER_SHOP_MAX_PHONE],
    ['hotline', 'Hotline', SELLER_SHOP_MAX_PHONE],
    ['openingHoursJson', 'Opening hours', SELLER_SHOP_MAX_OPENING_HOURS],
  ];

  for (const [field, label, max] of optionalChecks) {
    const trimmed = values[field].trim();
    if (!trimmed) continue;
    try {
      validateMaxLength(trimmed, max, label);
    } catch (error) {
      errors[field] = error instanceof Error ? error.message : `${label} is invalid.`;
    }
  }

  const email = values.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Email address is invalid.';
  }

  for (const [field, label] of [
    ['logoUrl', 'Logo URL'],
    ['bannerUrl', 'Banner URL'],
    ['websiteUrl', 'Website URL'],
    ['facebookUrl', 'Facebook URL'],
  ] as const) {
    if (!values[field].trim()) continue;
    try {
      optionalUrl(values[field], label);
    } catch (error) {
      errors[field] = error instanceof Error ? error.message : `${label} is invalid.`;
    }
  }

  return errors;
}

export function sellerShopFormToPayload(values: SellerShopFormValues): UpdateSellerShopPayload {
  return {
    shopName: values.shopName.trim(),
    tagline: values.tagline.trim() || null,
    shortDescription: values.shortDescription.trim() || null,
    description: values.description.trim() || null,
    logoUrl: values.logoUrl.trim() || null,
    bannerUrl: values.bannerUrl.trim() || null,
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    hotline: values.hotline.trim() || null,
    province: values.province.trim() || null,
    district: values.district.trim() || null,
    ward: values.ward.trim() || null,
    streetAddress: values.streetAddress.trim() || null,
    returnPolicy: values.returnPolicy.trim() || null,
    shippingPolicy: values.shippingPolicy.trim() || null,
    websiteUrl: values.websiteUrl.trim() || null,
    facebookUrl: values.facebookUrl.trim() || null,
    openingHoursJson: values.openingHoursJson.trim() || null,
  };
}

export function canSubmitSellerShopForm(
  dirty: boolean,
  errors: Partial<Record<SellerShopFormField, string>>,
  shopName: string,
): boolean {
  if (!dirty) return false;
  if (Object.keys(errors).length > 0) return false;
  return Boolean(shopName.trim());
}
