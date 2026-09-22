import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as reviewApi from '../services/reviewApi';
import type {
  CreateProductReviewRequest,
  CreateSellerRatingRequest,
  ProductReview,
  ProductReviewListQuery,
  ProductReviewListResult,
  SellerRating,
  UpdateProductReviewRequest,
} from '../types/review';
import { getApiErrorMessage } from '../utils/apiError';

export type ReviewState = {
  lists: Record<string, ProductReviewListResult>;
  loadingKeys: string[];
  mutating: boolean;
  error: string | null;
};

type ReviewRoot = { review: ReviewState };

const initialState: ReviewState = {
  lists: {},
  loadingKeys: [],
  mutating: false,
  error: null,
};

function requireData<T>(
  result: { success: boolean; data?: T | null; message?: string | null },
  fallback: string,
): T {
  if (!result.success || result.data == null) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

export function reviewListKey(productId: string, query: ProductReviewListQuery): string {
  const rating = query.rating ?? 'all';
  return `${productId}:${query.page ?? 1}:${query.pageSize ?? 20}:${rating}`;
}

export const fetchProductReviews = createAsyncThunk<
  { key: string; data: ProductReviewListResult },
  { productId: string; query: ProductReviewListQuery },
  { rejectValue: string }
>('review/fetchProductReviews', async ({ productId, query }, { rejectWithValue }) => {
  try {
    const result = await reviewApi.getProductReviews(productId, query);
    const data = requireData(result, 'Unable to load reviews.');
    return { key: reviewListKey(productId, query), data };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load reviews.'));
  }
});

export const createProductReview = createAsyncThunk<
  { productId: string; review: ProductReview },
  { productId: string; request: CreateProductReviewRequest },
  { rejectValue: string }
>('review/createProductReview', async ({ productId, request }, { rejectWithValue }) => {
  try {
    const result = await reviewApi.createProductReview(productId, request);
    return { productId, review: requireData(result, 'Unable to submit review.') };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to submit review.'));
  }
});

export const updateProductReview = createAsyncThunk<
  ProductReview,
  { reviewId: string; request: UpdateProductReviewRequest },
  { rejectValue: string }
>('review/updateProductReview', async ({ reviewId, request }, { rejectWithValue }) => {
  try {
    const result = await reviewApi.updateProductReview(reviewId, request);
    return requireData(result, 'Unable to update review.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to update review.'));
  }
});

export const deleteProductReview = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('review/deleteProductReview', async (reviewId, { rejectWithValue }) => {
  try {
    const result = await reviewApi.deleteProductReview(reviewId);
    if (!result.success) {
      throw new Error(result.message || 'Unable to remove review.');
    }
    return reviewId;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to remove review.'));
  }
});

export const reportProductReview = createAsyncThunk<
  string,
  { reviewId: string; reason: string; details?: string | null },
  { rejectValue: string }
>('review/reportProductReview', async ({ reviewId, reason, details }, { rejectWithValue }) => {
  try {
    const result = await reviewApi.reportProductReview(reviewId, { reason, details });
    requireData(result, 'Unable to report review.');
    return reviewId;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to report review.'));
  }
});

export const createSellerRating = createAsyncThunk<
  SellerRating,
  CreateSellerRatingRequest,
  { rejectValue: string }
>('review/createSellerRating', async (request, { rejectWithValue }) => {
  try {
    const result = await reviewApi.createSellerRating(request);
    return requireData(result, 'Unable to submit seller rating.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to submit seller rating.'));
  }
});

export const reviewSlice = createSlice({
  name: 'review',
  initialState,
  reducers: {
    invalidateProductReviews(state, action: PayloadAction<string>) {
      const productId = action.payload;
      for (const key of Object.keys(state.lists)) {
        if (key.startsWith(`${productId}:`)) {
          delete state.lists[key];
        }
      }
    },
    clearReviewState() {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchProductReviews.pending, (state, action) => {
        const key = reviewListKey(action.meta.arg.productId, action.meta.arg.query);
        if (!state.loadingKeys.includes(key)) state.loadingKeys.push(key);
        state.error = null;
      })
      .addCase(fetchProductReviews.fulfilled, (state, action) => {
        state.loadingKeys = state.loadingKeys.filter((k) => k !== action.payload.key);
        state.lists[action.payload.key] = action.payload.data;
      })
      .addCase(fetchProductReviews.rejected, (state, action) => {
        const { productId, query } = action.meta.arg;
        const key = reviewListKey(productId, query);
        state.loadingKeys = state.loadingKeys.filter((k) => k !== key);
        state.error = action.payload ?? 'Unable to load reviews.';
      })
      .addCase(createProductReview.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createProductReview.fulfilled, (state, action) => {
        state.mutating = false;
        const productId = action.payload.productId;
        for (const key of Object.keys(state.lists)) {
          if (key.startsWith(`${productId}:`)) delete state.lists[key];
        }
      })
      .addCase(createProductReview.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to submit review.';
      })
      .addCase(updateProductReview.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateProductReview.fulfilled, (state, action) => {
        state.mutating = false;
        const productId = action.payload.productId;
        for (const [key, list] of Object.entries(state.lists)) {
          if (!key.startsWith(`${productId}:`)) continue;
          state.lists[key] = {
            ...list,
            items: list.items.map((item) =>
              item.reviewId === action.payload.reviewId ? action.payload : item,
            ),
          };
        }
      })
      .addCase(updateProductReview.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to update review.';
      })
      .addCase(deleteProductReview.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteProductReview.fulfilled, (state, action) => {
        state.mutating = false;
        for (const [key, list] of Object.entries(state.lists)) {
          state.lists[key] = {
            ...list,
            items: list.items.filter((item) => item.reviewId !== action.payload),
            totalCount: Math.max(0, list.totalCount - 1),
          };
        }
      })
      .addCase(deleteProductReview.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to remove review.';
      })
      .addCase(reportProductReview.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(reportProductReview.fulfilled, (state, action) => {
        state.mutating = false;
        for (const [key, list] of Object.entries(state.lists)) {
          state.lists[key] = {
            ...list,
            items: list.items.map((item) =>
              item.reviewId === action.payload
                ? {
                    ...item,
                    canReport: false,
                    countsTowardRating: false,
                    moderationStatus: 'Reported',
                  }
                : item,
            ),
          };
        }
      })
      .addCase(reportProductReview.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to report review.';
      })
      .addCase(createSellerRating.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createSellerRating.fulfilled, (state) => {
        state.mutating = false;
      })
      .addCase(createSellerRating.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to submit seller rating.';
      });
  },
});

export const { invalidateProductReviews, clearReviewState } = reviewSlice.actions;

export const selectReviewList =
  (productId: string, query: ProductReviewListQuery) => (state: ReviewRoot) => {
    const key = reviewListKey(productId, query);
    return state.review.lists[key] ?? null;
  };

export const selectReviewListLoading =
  (productId: string, query: ProductReviewListQuery) => (state: ReviewRoot) => {
    const key = reviewListKey(productId, query);
    return state.review.loadingKeys.includes(key);
  };

export const selectReviewMutating = (state: ReviewRoot) => state.review.mutating;
export const selectReviewError = (state: ReviewRoot) => state.review.error;
