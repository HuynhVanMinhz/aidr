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
  isOwn: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
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
export type SellerRatingApiResult = ApiResult<SellerRating>;
