export type AdminCategory = {
  categoryId: number;
  parentId?: number | null;
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

export type ApproveSellerRegistrationResult = {
  request: AdminSellerRegistration;
  shopId: string;
  walletId: string;
};

export type RejectSellerRegistrationPayload = {
  adminNote: string;
};

export type SellerRegistrationStatusFilter = SellerRegistrationStatus | 'all';
