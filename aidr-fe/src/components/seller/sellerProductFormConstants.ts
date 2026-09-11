export const SELLER_PRODUCT_MAX_NAME = 256;
export const SELLER_PRODUCT_MAX_SLUG = 280;
export const SELLER_PRODUCT_MAX_SHORT_DESCRIPTION = 500;
export const SELLER_PRODUCT_MAX_BRAND = 100;
export const SELLER_PRODUCT_MAX_MODEL = 100;
export const SELLER_PRODUCT_MAX_ORIGIN = 80;
export const SELLER_PRODUCT_MAX_TAGS_JSON = 4000;
export const SELLER_PRODUCT_MAX_SPECS_JSON = 8000;
export const SELLER_PRODUCT_MAX_IMAGES = 20;
export const SELLER_PRODUCT_MAX_IMAGE_URL = 512;
export const SELLER_PRODUCT_DEFAULT_PAGE_SIZE = 20;

export const SELLER_PRODUCT_CONDITIONS = ['New', 'LikeNew', 'Refurbished', 'Used'] as const;

/**
 * Starting points for the tag and spec editors. They are hints, not a closed
 * list — anything typed is accepted, these just save the common cases.
 */
export const PRODUCT_TAG_SUGGESTIONS = [
  'flagship',
  'new-arrival',
  'best-seller',
  'limited',
  'gaming',
  'genuine',
];

export const PRODUCT_SPEC_SUGGESTIONS = [
  'CPU',
  'RAM',
  'Storage',
  'Screen',
  'Battery',
  'Camera',
  'Weight',
  'Color',
  'Material',
  'Size',
  'Ports',
  'Operating system',
];

export const SELLER_PRODUCT_STATUS_FILTERS = [
  { value: '', label: 'Active (hide deleted)' },
  { value: 'all', label: 'All statuses' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Deleted', label: 'Deleted' },
] as const;

export type SellerProductFormValues = {
  categoryId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  brand: string;
  modelNumber: string;
  conditionType: string;
  basePrice: string;
  salePrice: string;
  warrantyMonths: string;
  originCountry: string;
  tagsJson: string;
  specsJson: string;
};

export type SellerProductStagedImage = {
  localId: string;
  imageUrl: string;
  publicId?: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export function emptySellerProductForm(
  overrides?: Partial<SellerProductFormValues>,
): SellerProductFormValues {
  return {
    categoryId: '',
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    brand: '',
    modelNumber: '',
    conditionType: 'New',
    basePrice: '',
    salePrice: '',
    warrantyMonths: '',
    originCountry: '',
    tagsJson: '',
    specsJson: '',
    ...overrides,
  };
}
