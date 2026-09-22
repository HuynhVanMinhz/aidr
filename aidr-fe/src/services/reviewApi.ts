import type {
  CreateProductReviewRequest,
  CreateSellerRatingRequest,
  ProductReviewListApiResult,
  ProductReviewListQuery,
  ProductReviewApiResult,
  ProductReviewReportApiResult,
  ReportProductReviewRequest,
  SellerRatingApiResult,
  UpdateProductReviewRequest,
  AdminReviewModerationListApiResult,
  AdminReviewModerationStatusFilter,
} from '../types/review';
import { apiClient } from './apiClient';

export async function getProductReviews(productId: string, query?: ProductReviewListQuery) {
  const { data } = await apiClient.get<ProductReviewListApiResult>(
    `/products/${productId}/reviews`,
    {
      params: {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
        rating: query?.rating ?? undefined,
      },
    },
  );
  return data;
}

export async function createProductReview(
  productId: string,
  request: CreateProductReviewRequest,
) {
  const { data } = await apiClient.post<ProductReviewApiResult>(
    `/products/${productId}/reviews`,
    request,
  );
  return data;
}

export async function updateProductReview(reviewId: string, request: UpdateProductReviewRequest) {
  const { data } = await apiClient.put<ProductReviewApiResult>(`/reviews/${reviewId}`, request);
  return data;
}

export async function deleteProductReview(reviewId: string) {
  const { data } = await apiClient.delete<{ success: boolean; message?: string | null }>(
    `/reviews/${reviewId}`,
  );
  return data;
}

export async function reportProductReview(reviewId: string, request: ReportProductReviewRequest) {
  const { data } = await apiClient.post<ProductReviewReportApiResult>(
    `/reviews/${reviewId}/report`,
    request,
  );
  return data;
}

export async function createSellerRating(request: CreateSellerRatingRequest) {
  const { data } = await apiClient.post<SellerRatingApiResult>('/seller-ratings', request);
  return data;
}

export async function getAdminReviewModeration(params: {
  status?: AdminReviewModerationStatusFilter;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await apiClient.get<AdminReviewModerationListApiResult>(
    '/admin/reviews/moderation',
    {
      params: {
        status: params.status ?? 'Reported',
        q: params.q || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
      },
    },
  );
  return data;
}

export async function approveAdminReview(reviewId: string) {
  const { data } = await apiClient.post<{ success: boolean; message?: string | null }>(
    `/admin/reviews/${reviewId}/approve`,
  );
  return data;
}

export async function hideAdminReview(reviewId: string) {
  const { data } = await apiClient.post<{ success: boolean; message?: string | null }>(
    `/admin/reviews/${reviewId}/hide`,
  );
  return data;
}
