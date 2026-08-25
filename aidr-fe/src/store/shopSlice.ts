import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as sellerApi from '../services/sellerApi';
import type { ProductSort } from '../types/catalog';
import type { ShopPublicDetail, ShopSellerRating } from '../types/shop';

export type ShopProductFilters = {
  q: string;
  sort: ProductSort;
  page: number;
  pageSize: number;
};

export type ShopState = {
  shopKey: string | null;
  shop: ShopPublicDetail | null;
  rating: ShopSellerRating | null;
  filters: ShopProductFilters;
  queryKey: string | null;
  loading: boolean;
  ratingLoading: boolean;
  error: string | null;
  ratingError: string | null;
};

type ShopRoot = { shop: ShopState };

export const defaultShopProductFilters: ShopProductFilters = {
  q: '',
  sort: 'newest',
  page: 1,
  pageSize: 12,
};

const initialState: ShopState = {
  shopKey: null,
  shop: null,
  rating: null,
  filters: { ...defaultShopProductFilters },
  queryKey: null,
  loading: false,
  ratingLoading: false,
  error: null,
  ratingError: null,
};

function buildShopQueryKey(shopKey: string, filters: ShopProductFilters): string {
  return JSON.stringify({
    shopKey,
    q: filters.q.trim(),
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
  });
}

export const fetchShop = createAsyncThunk(
  'shop/fetchShop',
  async (
    args: { shopKey: string; filters?: Partial<ShopProductFilters> },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as ShopRoot;
      const filters: ShopProductFilters = {
        ...state.shop.filters,
        ...args.filters,
      };

      const result = await sellerApi.getShop(args.shopKey, {
        q: filters.q.trim() || undefined,
        sort: filters.sort,
        page: filters.page,
        pageSize: filters.pageSize,
      });

      if (!result.success || !result.data) {
        return rejectWithValue(result.message || 'Shop not found.');
      }

      return {
        shopKey: args.shopKey,
        shop: result.data,
        filters,
        queryKey: buildShopQueryKey(args.shopKey, filters),
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Shop not found.');
    }
  },
);

export const fetchShopRating = createAsyncThunk(
  'shop/fetchShopRating',
  async (shopKey: string, { rejectWithValue }) => {
    try {
      const result = await sellerApi.getShopRating(shopKey);
      if (!result.success || !result.data) {
        return rejectWithValue(result.message || 'Unable to load shop rating.');
      }
      return result.data;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Unable to load shop rating.',
      );
    }
  },
);

export const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    clearShop(state) {
      state.shopKey = null;
      state.shop = null;
      state.rating = null;
      state.filters = { ...defaultShopProductFilters };
      state.queryKey = null;
      state.loading = false;
      state.ratingLoading = false;
      state.error = null;
      state.ratingError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchShop.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        if (state.shopKey && state.shopKey !== action.meta.arg.shopKey) {
          state.shop = null;
          state.rating = null;
        }
      })
      .addCase(fetchShop.fulfilled, (state, action) => {
        state.loading = false;
        state.shopKey = action.payload.shopKey;
        state.shop = action.payload.shop;
        state.filters = action.payload.filters;
        state.queryKey = action.payload.queryKey;
      })
      .addCase(fetchShop.rejected, (state, action) => {
        state.loading = false;
        state.shop = null;
        state.error = (action.payload as string) || 'Shop not found.';
      })
      .addCase(fetchShopRating.pending, (state) => {
        state.ratingLoading = true;
        state.ratingError = null;
      })
      .addCase(fetchShopRating.fulfilled, (state, action) => {
        state.ratingLoading = false;
        state.rating = action.payload;
      })
      .addCase(fetchShopRating.rejected, (state, action) => {
        state.ratingLoading = false;
        state.rating = null;
        state.ratingError = (action.payload as string) || 'Unable to load shop rating.';
      });
  },
});

export const { clearShop } = shopSlice.actions;

export const selectShop = (state: ShopRoot) => state.shop.shop;
export const selectShopRating = (state: ShopRoot) => state.shop.rating;
export const selectShopFilters = (state: ShopRoot) => state.shop.filters;
export const selectShopLoading = (state: ShopRoot) => state.shop.loading;
export const selectShopRatingLoading = (state: ShopRoot) => state.shop.ratingLoading;
export const selectShopError = (state: ShopRoot) => state.shop.error;
export const selectShopRatingError = (state: ShopRoot) => state.shop.ratingError;
