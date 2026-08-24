export type AdminCategory = {
  categoryId: number;
  parentId?: number | null;
  parentName?: string | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminCategoryOption = {
  categoryId: number;
  parentId?: number | null;
  name: string;
  sortOrder: number;
};

export type AdminCategoryListResult = {
  items: AdminCategory[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  activeCount: number;
  inactiveCount: number;
  withProductsCount: number;
};

export type AdminCategoryListQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export type CreateCategoryPayload = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  parentId?: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type UpdateCategoryPayload = {
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  parentId?: number | null;
};

export type SellerRegistrationStatus = 'Pending' | 'Approved' | 'Rejected';

export type AdminSellerRegistration = {
  requestId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  shopName: string;
  businessInfo?: string | null;
  documentUrls: string[];
  status: SellerRegistrationStatus | string;
  adminNote?: string | null;
  reviewedBy?: string | null;
  reviewerFullName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  shopId?: string | null;
};

export type AdminSellerRegistrationListResult = {
  items: AdminSellerRegistration[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

export type SellerRegistrationListQuery = {
  status?: SellerRegistrationStatusFilter;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type ApproveSellerRegistrationResult = {
  request: AdminSellerRegistration;
  shopId: string;
  walletId: string;
};

export type RejectSellerRegistrationPayload = {
  adminNote: string;
};

export type SellerRegistrationStatusFilter = SellerRegistrationStatus | 'all';

export type AdminProductStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Inactive'
  | 'Deleted';

export type AdminProductStatusFilter = AdminProductStatus | 'all';

export type AdminProductImage = {
  productImageId: string;
  imageUrl: string;
  publicId?: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type AdminProductListItem = {
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
  status: AdminProductStatus | string;
  primaryImageUrl?: string | null;
  categoryId: number;
  categoryName: string;
  shopId: string;
  shopName: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProductDetail = {
  productId: string;
  shopId: string;
  shopName: string;
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
  status: AdminProductStatus | string;
  publishedAt?: string | null;
  avgRating: number;
  reviewCount: number;
  soldCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  images: AdminProductImage[];
};

export type AdminProductListResult = {
  items: AdminProductListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

export type AdminProductListQuery = {
  status?: AdminProductStatusFilter;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type RejectProductPayload = {
  reason: string;
};

export type ProductModerationHistoryItem = {
  moderationId: number;
  productId: string;
  adminUserId: string;
  adminFullName: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  reason?: string | null;
  createdAt: string;
};

export type ProductModerationHistoryResult = {
  productId: string;
  productName: string;
  currentStatus: string;
  items: ProductModerationHistoryItem[];
};
