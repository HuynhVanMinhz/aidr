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
  currency: string;
  stockQuantity: number;
  reservedQuantity: number;
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
