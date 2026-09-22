import type { ApiResult } from './auth';

export type ProductReview = {
  reviewId: string;
  productId: string;
  buyerUserId: string;
  orderId?: string | null;
  rating: number;
  title?: string | null;
  content?: string | null;
  sentimentLabel?: string | null;
  sentimentScore?: number | null;
  buyerName: string;
  buyerAvatarUrl?: string | null;
  isVisible: boolean;
  countsTowardRating?: boolean;
  moderationStatus?: string;
  isOwn: boolean;
  canEdit: boolean;
  canReport?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReportProductReviewRequest = {
  reason: string;
  details?: string | null;
};

export type ProductReviewReport = {
  reportId: string;
  reviewId: string;
  reporterUserId: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
};

export type ProductReviewListQuery = {
  rating?: number | null;
  page?: number;
  pageSize?: number;
};

export type ProductReviewListResult = {
  productId: string;
  avgRating: number;
  reviewCount: number;
  /** Counts for stars 1–5 (index 0 = 1★ … index 4 = 5★). */
  ratingBreakdown?: number[] | null;
  items: ProductReview[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type CreateProductReviewRequest = {
  orderId: string;
  rating: number;
  title?: string | null;
  content: string;
};

export type UpdateProductReviewRequest = {
  rating: number;
  title?: string | null;
  content: string;
};

export type CreateSellerRatingRequest = {
  shopId: string;
  orderId: string;
  score: number;
  comment?: string | null;
};

export type SellerRating = {
  sellerRatingId: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  buyerUserId: string;
  orderId?: string | null;
  score: number;
  comment?: string | null;
  shopAvgRating: number;
  shopRatingCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductReviewListApiResult = ApiResult<ProductReviewListResult>;
export type ProductReviewApiResult = ApiResult<ProductReview>;
export type ProductReviewReportApiResult = ApiResult<ProductReviewReport>;
export type SellerRatingApiResult = ApiResult<SellerRating>;

export type AdminReviewModerationStatusFilter = 'PendingTrust' | 'Reported' | 'all';

export type AdminReviewModerationItem = {
  reviewId: string;
  productId: string;
  productName: string;
  shopId: string;
  shopName: string;
  buyerUserId: string;
  buyerName: string;
  buyerEmail?: string | null;
  rating: number;
  title?: string | null;
  content?: string | null;
  moderationStatus: string;
  countsTowardRating: boolean;
  isVisible: boolean;
  openReportCount: number;
  latestReportReason?: string | null;
  latestReportDetails?: string | null;
  latestReporterUserId?: string | null;
  latestReporterName?: string | null;
  latestReporterEmail?: string | null;
  latestReporterIsShopOwner?: boolean;
  createdAt: string;
  trustReleaseAt?: string | null;
};

export type AdminReviewModerationListResult = {
  summary: {
    pendingTrustCount: number;
    reportedCount: number;
  };
  items: AdminReviewModerationItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminReviewModerationListApiResult = ApiResult<AdminReviewModerationListResult>;