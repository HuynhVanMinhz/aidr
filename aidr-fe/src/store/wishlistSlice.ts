import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as wishlistApi from '../services/wishlistApi';
import type {
  RemoveWishlistItemResponse,
  WishlistItem,
  WishlistListQuery,
  WishlistListResult,
} from '../types/wishlist';
import { getApiErrorMessage } from '../utils/apiError';

export type WishlistState = {
  items: WishlistItem[];
  productIds: string[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
  membershipLoaded: boolean;
};

type WishlistRoot = { wishlist: WishlistState };

const initialState: WishlistState = {
  items: [],
  productIds: [],
  page: 1,
  pageSize: 20,
  totalCount: 0,
  totalPages: 0,
  loading: false,
  mutating: false,
  error: null,
  loaded: false,
  membershipLoaded: false,
};

function requireData<T>(result: { success: boolean; data?: T | null; message?: string | null }, fallback: string): T {
  if (!result.success || result.data == null) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

function mergeProductIds(existing: string[], next: string[]): string[] {
  const set = new Set(existing);
  for (const id of next) set.add(id);
  return Array.from(set);
}

function applyList(state: WishlistState, list: WishlistListResult) {
  state.items = list.items ?? [];
  state.page = list.page;
  state.pageSize = list.pageSize;
  state.totalCount = list.totalCount;
  state.totalPages = list.totalPages;
  state.productIds = mergeProductIds(
    state.productIds,
    (list.items ?? []).map((item) => item.productId),
  );
  state.loaded = true;
  state.error = null;
}

export const fetchWishlist = createAsyncThunk<
  WishlistListResult,
  WishlistListQuery | undefined,
  { rejectValue: string }
>('wishlist/fetch', async (query, { rejectWithValue }) => {
  try {
    const result = await wishlistApi.getWishlist(query);
    return requireData(result, 'Unable to load wishlist.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load wishlist.'));
  }
});

/** Loads up to 100 product ids for membership checks on catalog cards. */
export const fetchWishlistMembership = createAsyncThunk<
  WishlistListResult,
  void,
  { rejectValue: string }
>('wishlist/fetchMembership', async (_, { rejectWithValue }) => {
  try {
    const result = await wishlistApi.getWishlist({ page: 1, pageSize: 100 });
    return requireData(result, 'Unable to load wishlist.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load wishlist.'));
  }
});

export const addWishlistItem = createAsyncThunk<WishlistItem, string, { rejectValue: string }>(
  'wishlist/addItem',
  async (productId, { rejectWithValue }) => {
    try {
      const result = await wishlistApi.addWishlistItem({ productId });
      return requireData(result, 'Unable to add product to wishlist.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to add product to wishlist.'));
    }
  },
);

export const removeWishlistItem = createAsyncThunk<
  RemoveWishlistItemResponse,
  string,
  { rejectValue: string }
>('wishlist/removeItem', async (wishlistItemId, { rejectWithValue }) => {
  try {
    const result = await wishlistApi.removeWishlistItem(wishlistItemId);
    return requireData(result, 'Unable to remove product from wishlist.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to remove product from wishlist.'));
  }
});

export const removeWishlistProduct = createAsyncThunk<
  RemoveWishlistItemResponse,
  string,
  { rejectValue: string }
>('wishlist/removeProduct', async (productId, { rejectWithValue }) => {
  try {
    const result = await wishlistApi.removeWishlistProduct(productId);
    return requireData(result, 'Unable to remove product from wishlist.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to remove product from wishlist.'));
  }
});

export const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    clearWishlistState() {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.loading = false;
        applyList(state, action.payload);
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to load wishlist.';
      })
      .addCase(fetchWishlistMembership.fulfilled, (state, action) => {
        state.productIds = (action.payload.items ?? []).map((item) => item.productId);
        state.totalCount = action.payload.totalCount;
        state.membershipLoaded = true;
      })
      .addCase(fetchWishlistMembership.rejected, (state) => {
        state.membershipLoaded = true;
      })
      .addCase(addWishlistItem.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(addWishlistItem.fulfilled, (state, action) => {
        state.mutating = false;
        const item = action.payload;
        if (!state.productIds.includes(item.productId)) {
          state.productIds = [...state.productIds, item.productId];
          state.totalCount += 1;
        }
        const existingIndex = state.items.findIndex((row) => row.productId === item.productId);
        if (existingIndex >= 0) {
          state.items[existingIndex] = item;
        } else if (state.page === 1) {
          state.items = [item, ...state.items].slice(0, state.pageSize);
        }
      })
      .addCase(addWishlistItem.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to add product to wishlist.';
      })
      .addCase(removeWishlistItem.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(removeWishlistItem.fulfilled, (state, action) => {
        state.mutating = false;
        const { wishlistItemId, productId } = action.payload;
        state.items = state.items.filter((item) => item.wishlistItemId !== wishlistItemId);
        state.productIds = state.productIds.filter((id) => id !== productId);
        state.totalCount = Math.max(0, state.totalCount - 1);
      })
      .addCase(removeWishlistItem.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to remove product from wishlist.';
      })
      .addCase(removeWishlistProduct.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(removeWishlistProduct.fulfilled, (state, action) => {
        state.mutating = false;
        const { wishlistItemId, productId } = action.payload;
        state.items = state.items.filter(
          (item) => item.wishlistItemId !== wishlistItemId && item.productId !== productId,
        );
        state.productIds = state.productIds.filter((id) => id !== productId);
        state.totalCount = Math.max(0, state.totalCount - 1);
      })
      .addCase(removeWishlistProduct.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to remove product from wishlist.';
      });
  },
});

export const { clearWishlistState } = wishlistSlice.actions;

export const selectWishlist = (state: WishlistRoot) => state.wishlist;
export const selectWishlistItems = (state: WishlistRoot) => state.wishlist.items;
export const selectWishlistProductIds = (state: WishlistRoot) => state.wishlist.productIds;
export const selectWishlistTotalCount = (state: WishlistRoot) => state.wishlist.totalCount;
export const selectWishlistLoading = (state: WishlistRoot) => state.wishlist.loading;
export const selectWishlistMutating = (state: WishlistRoot) => state.wishlist.mutating;
export const selectWishlistError = (state: WishlistRoot) => state.wishlist.error;
export const selectWishlistLoaded = (state: WishlistRoot) => state.wishlist.loaded;
export const selectWishlistMembershipLoaded = (state: WishlistRoot) => state.wishlist.membershipLoaded;
export const selectIsInWishlist = (productId: string) => (state: WishlistRoot) =>
  state.wishlist.productIds.includes(productId);
