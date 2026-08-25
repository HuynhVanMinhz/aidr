import type {
  CreateProductReviewRequest,
  CreateSellerRatingRequest,
  ProductReviewListApiResult,
  ProductReviewListQuery,
  ProductReviewApiResult,
  SellerRatingApiResult,
  UpdateProductReviewRequest,
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

export async function createSellerRating(request: CreateSellerRatingRequest) {
  const { data } = await apiClient.post<SellerRatingApiResult>('/seller-ratings', request);
  return data;
}
