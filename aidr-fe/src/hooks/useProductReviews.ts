import { useCallback, useEffect, useMemo } from 'react';
import {
  createProductReview,
  createSellerRating,
  deleteProductReview,
  fetchProductReviews,
  selectReviewList,
  selectReviewListLoading,
  selectReviewMutating,
  updateProductReview,
} from '../store/reviewSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type {
  CreateProductReviewRequest,
  CreateSellerRatingRequest,
  ProductReviewListQuery,
  UpdateProductReviewRequest,
} from '../types/review';
import { getApiErrorMessage } from '../utils/apiError';

export function useProductReviews(
  productId: string | undefined,
  query?: ProductReviewListQuery,
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const autoLoad = options?.autoLoad ?? true;

  const normalizedQuery = useMemo(
    () => ({
      rating: query?.rating ?? null,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    }),
    [query?.page, query?.pageSize, query?.rating],
  );

  const list = useAppSelector(
    productId ? selectReviewList(productId, normalizedQuery) : () => null,
  );
  const loading = useAppSelector(
    productId ? selectReviewListLoading(productId, normalizedQuery) : () => false,
  );
  const mutating = useAppSelector(selectReviewMutating);

  useEffect(() => {
    if (!autoLoad || !productId) return;
    void dispatch(fetchProductReviews({ productId, query: normalizedQuery }));
  }, [autoLoad, dispatch, normalizedQuery, productId]);

  const refresh = useCallback(async () => {
    if (!productId) throw new Error('Product id is required.');
    return dispatch(fetchProductReviews({ productId, query: normalizedQuery })).unwrap();
  }, [dispatch, normalizedQuery, productId]);

  const submitReview = useCallback(
    async (request: CreateProductReviewRequest) => {
      if (!productId) throw new Error('Product id is required.');
      const result = await dispatch(createProductReview({ productId, request }));
      if (createProductReview.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to submit review.');
      }
      await dispatch(fetchProductReviews({ productId, query: normalizedQuery }));
      return result.payload.review;
    },
    [dispatch, normalizedQuery, productId],
  );

  const editReview = useCallback(
    async (reviewId: string, request: UpdateProductReviewRequest) => {
      const result = await dispatch(updateProductReview({ reviewId, request }));
      if (updateProductReview.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to update review.');
      }
      if (productId) {
        await dispatch(fetchProductReviews({ productId, query: normalizedQuery }));
      }
      return result.payload;
    },
    [dispatch, normalizedQuery, productId],
  );

  const removeReview = useCallback(
    async (reviewId: string) => {
      const result = await dispatch(deleteProductReview(reviewId));
      if (deleteProductReview.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to remove review.');
      }
      if (productId) {
        await dispatch(fetchProductReviews({ productId, query: normalizedQuery }));
      }
    },
    [dispatch, normalizedQuery, productId],
  );

  return {
    list,
    loading,
    mutating,
    refresh,
    submitReview,
    editReview,
    removeReview,
    getErrorMessage: getApiErrorMessage,
  };
}

export function useSellerRatingSubmit() {
  const dispatch = useAppDispatch();
  const mutating = useAppSelector(selectReviewMutating);

  const submitRating = useCallback(
    async (request: CreateSellerRatingRequest) => {
      const result = await dispatch(createSellerRating(request));
      if (createSellerRating.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to submit seller rating.');
      }
      return result.payload;
    },
    [dispatch],
  );

  return {
    mutating,
    submitRating,
    getErrorMessage: getApiErrorMessage,
  };
}
