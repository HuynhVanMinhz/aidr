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
