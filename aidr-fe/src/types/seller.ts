export type SellerProductStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Inactive'
  | 'Deleted';

export type SellerProductStatusFilter = SellerProductStatus | 'all' | '';

export type SellerProductCondition = 'New' | 'LikeNew' | 'Refurbished' | 'Used';

export type SellerProductImage = {
  productImageId: string;
  imageUrl: string;
  publicId?: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

/** One axis the seller declares, e.g. Color -> [Orange, White]. */
export type SellerProductVariantOption = {
  name: string;
  values: string[];
};

export type SellerProductVariant = {
  variantId: string;
  sku?: string | null;
  variantName: string;
  attributes: Record<string, string>;
  price: number;
  salePrice?: number | null;
  effectivePrice: number;
  /** Summed from this variant's inventory lots - not editable on the product form. */
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type SellerProductVariantOptionInput = {
  name: string;
  values: string[];
};

export type SellerProductVariantInput = {
  /** Omit for a new row; supply to update the existing variant in place. */
  variantId?: string | null;
  sku?: string | null;
  /** Derived from the attribute values when left blank. */
  variantName?: string | null;
  attributes: Record<string, string>;
  price: number;
  salePrice?: number | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type SellerProductListItem = {
  productId: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  brand?: string | null;
  conditionType: string;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  /** Dearest active variant; equals effectivePrice when there are none. */
  maxEffectivePrice: number;
  currency: string;
  stockQuantity: number;
  reservedQuantity: number;
  variantCount: number;
  status: string;
  primaryImageUrl?: string | null;
  categoryId: number;
  categoryName: string;
  shopId: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SellerProductDetail = {
  productId: string;
  shopId: string;
  categoryId: number;
  categoryName: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  conditionType: string;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  currency: string;
  stockQuantity: number;
  reservedQuantity: number;
  warrantyMonths?: number | null;
  originCountry?: string | null;
  tagsJson?: string | null;
  specsJson?: string | null;
  isFeatured: boolean;
  status: string;
  publishedAt?: string | null;
  avgRating: number;
  reviewCount: number;
  soldCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  images: SellerProductImage[];
  variantOptions: SellerProductVariantOption[];
  /** Empty when the product is sold as a single configuration. */
  variants: SellerProductVariant[];
};

export type SellerProductImageInput = {
  imageUrl: string;
  publicId?: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type SellerProductQuery = {
  status?: SellerProductStatusFilter;
  q?: string;
  categoryId?: number;
  page?: number;
  pageSize?: number;
};

export type CreateSellerProductPayload = {
  categoryId: number;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  conditionType: string;
  basePrice: number;
  salePrice?: number | null;
  warrantyMonths?: number | null;
  originCountry?: string | null;
  tagsJson?: string | null;
  specsJson?: string | null;
  images?: SellerProductImageInput[];
  /**
   * Send both together to sell the product in several configurations, or omit both to keep
   * it single-price. On update, omitting them leaves the stored variants untouched while
   * sending empty arrays clears them.
   */
  variantOptions?: SellerProductVariantOptionInput[];
  variants?: SellerProductVariantInput[];
};

export type UpdateSellerProductPayload = {
  categoryId: number;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  conditionType: string;
  basePrice: number;
  salePrice?: number | null;
  warrantyMonths?: number | null;
  originCountry?: string | null;
  tagsJson?: string | null;
  specsJson?: string | null;
  variantOptions?: SellerProductVariantOptionInput[];
  variants?: SellerProductVariantInput[];
};

export type UploadSellerProductImagesPayload = {
  images: SellerProductImageInput[];
  replaceExisting: boolean;
};

export type SellerShopVoucher = {
  voucherId: string;
  code: string;
  name: string;
  description?: string | null;
  scope: string;
  shopId: string;
  shopName?: string | null;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  usageLimit?: number | null;
  perUserLimit: number;
  usedCount: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
};

export type SellerShopVoucherListResult = {
  items: SellerShopVoucher[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  activeCount: number;
  inactiveCount: number;
  expiredCount: number;
};

export type SellerShopVoucherListQuery = {
  q?: string;
  isActive?: boolean | null;
  page?: number;
  pageSize?: number;
};

export type CreateShopVoucherPayload = {
  code: string;
  name: string;
  description?: string | null;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  usageLimit?: number | null;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export type UpdateShopVoucherPayload = {
  name: string;
  description?: string | null;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  usageLimit?: number | null;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
};
