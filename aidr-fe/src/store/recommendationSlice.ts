import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession, setSession } from './authSlice';
import * as aiApi from '../services/aiApi';
import type { RecommendedProduct, SimilarProduct } from '../types/ai';
import { getApiErrorMessage } from '../utils/apiError';

export type RecommendationState = {
  items: RecommendedProduct[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  loadedForAuthKey: string | null;
  similarByProductId: Record<string, SimilarProduct[]>;
  similarLoadedIds: string[];
  similarLoadingId: string | null;
  similarError: string | null;
};

type RecommendationRoot = { recommendation: RecommendationState };

const initialState: RecommendationState = {
  items: [],
  page: 1,
  pageSize: 12,
  totalCount: 0,
  totalPages: 0,
  loading: false,
  error: null,
  loadedForAuthKey: null,
  similarByProductId: {},
  similarLoadedIds: [],
  similarLoadingId: null,
  similarError: null,
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

function markSimilarLoaded(state: RecommendationState, productId: string) {
  if (!state.similarLoadedIds.includes(productId)) {
    state.similarLoadedIds.push(productId);
  }
}

export const fetchRecommendations = createAsyncThunk(
  'recommendation/fetchRecommendations',
  async (
    args: { page?: number; pageSize?: number; authKey: string } | undefined,
    { rejectWithValue },
  ) => {
    try {
      const page = args?.page ?? 1;
      const pageSize = args?.pageSize ?? 12;
      const authKey = args?.authKey ?? 'anon';
      const result = await aiApi.getRecommendations({ page, pageSize });
      const data = requireData(result, 'Unable to load recommendations.');
      return { ...data, authKey };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load recommendations.'));
    }
  },
);

export const fetchSimilarProducts = createAsyncThunk(
  'recommendation/fetchSimilarProducts',
  async (args: { productId: string; limit?: number }, { rejectWithValue }) => {
    try {
      const result = await aiApi.getSimilarProducts(args.productId, { limit: args.limit ?? 12 });
      const items = requireData(result, 'Unable to load similar products.');
      return { productId: args.productId, items };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load similar products.'));
    }
  },
);

export const recommendationSlice = createSlice({
  name: 'recommendation',
  initialState,
  reducers: {
    clearSimilarProducts(state) {
      state.similarByProductId = {};
      state.similarLoadedIds = [];
      state.similarLoadingId = null;
      state.similarError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items ?? [];
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.totalCount = action.payload.totalCount;
        state.totalPages = action.payload.totalPages;
        state.loadedForAuthKey = action.payload.authKey;
        state.error = null;
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.loadedForAuthKey = action.meta.arg?.authKey ?? 'anon';
        state.error =
          (action.payload as string) || action.error.message || 'Unable to load recommendations.';
      })
      .addCase(fetchSimilarProducts.pending, (state, action) => {
        state.similarLoadingId = action.meta.arg.productId;
        state.similarError = null;
      })
      .addCase(fetchSimilarProducts.fulfilled, (state, action) => {
        state.similarLoadingId = null;
        state.similarByProductId[action.payload.productId] = action.payload.items ?? [];
        markSimilarLoaded(state, action.payload.productId);
        state.similarError = null;
      })
      .addCase(fetchSimilarProducts.rejected, (state, action) => {
        const productId = action.meta.arg.productId;
        state.similarLoadingId = null;
        state.similarByProductId[productId] = state.similarByProductId[productId] ?? [];
        markSimilarLoaded(state, productId);
        state.similarError =
          (action.payload as string) || action.error.message || 'Unable to load similar products.';
      })
      .addCase(clearSession, (state) => ({
        ...initialState,
        similarByProductId: state.similarByProductId,
        similarLoadedIds: state.similarLoadedIds,
      }))
      .addCase(setSession, (state) => {
        state.loadedForAuthKey = null;
        state.items = [];
      });
  },
});

export const { clearSimilarProducts } = recommendationSlice.actions;

export const selectRecommendations = (state: RecommendationRoot) => state.recommendation.items;
export const selectRecommendationsLoading = (state: RecommendationRoot) => state.recommendation.loading;
export const selectRecommendationsError = (state: RecommendationRoot) => state.recommendation.error;
export const selectRecommendationsAuthKey = (state: RecommendationRoot) =>
  state.recommendation.loadedForAuthKey;

export const selectSimilarProducts = (productId: string) => (state: RecommendationRoot) =>
  state.recommendation.similarByProductId[productId] ?? [];

export const selectSimilarLoaded = (productId: string) => (state: RecommendationRoot) =>
  state.recommendation.similarLoadedIds.includes(productId);

export const selectSimilarLoading = (productId: string) => (state: RecommendationRoot) =>
  state.recommendation.similarLoadingId === productId;

export const selectSimilarError = (state: RecommendationRoot) => state.recommendation.similarError;
