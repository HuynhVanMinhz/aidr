import { validateMaxLength, validateRequired } from './validators';

export const BUYER_SELLER_REGISTRATION_MAX_SHOP_NAME = 120;
export const BUYER_SELLER_REGISTRATION_MAX_BUSINESS_INFO = 2000;

export type BuyerSellerRegistrationFormField = 'shopName' | 'businessInfo' | 'documentUrls';

export type BuyerSellerRegistrationFormValues = {
  shopName: string;
  businessInfo: string;
  documentUrls: string;
};

export function parseDocumentUrls(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateBuyerSellerRegistrationForm(values: BuyerSellerRegistrationFormValues) {
  const errors: Partial<Record<BuyerSellerRegistrationFormField, string>> = {};

  try {
    const shopName = validateRequired(values.shopName, 'Shop name');
    validateMaxLength(shopName, BUYER_SELLER_REGISTRATION_MAX_SHOP_NAME, 'Shop name');
  } catch (error) {
    errors.shopName = error instanceof Error ? error.message : 'Shop name is invalid.';
  }

  const businessInfo = values.businessInfo.trim();
  if (businessInfo) {
    try {
      validateMaxLength(businessInfo, BUYER_SELLER_REGISTRATION_MAX_BUSINESS_INFO, 'Business info');
    } catch (error) {
      errors.businessInfo = error instanceof Error ? error.message : 'Business info is invalid.';
    }
  }

  const urls = parseDocumentUrls(values.documentUrls);
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Document URLs must use http or https.');
      }
    } catch {
      errors.documentUrls = 'Each document URL must be a valid http or https link (one per line).';
      break;
    }
  }

  return errors;
}

export function canSubmitBuyerSellerRegistrationForm(
  values: BuyerSellerRegistrationFormValues,
  dirty: boolean,
  errors: Partial<Record<BuyerSellerRegistrationFormField, string>>,
): boolean {
  if (!dirty) return false;
  if (Object.keys(errors).length > 0) return false;
  return Boolean(values.shopName.trim());
}
