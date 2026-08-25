import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as followApi from '../services/followApi';
import type {
  FollowedShop,
  FollowListQuery,
  FollowListResult,
  UnfollowShopResponse,
} from '../types/follow';
import { getApiErrorMessage } from '../utils/apiError';

export type FollowState = {
  items: FollowedShop[];
  shopIds: string[];
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

type FollowRoot = { follow: FollowState };

const initialState: FollowState = {
  items: [],
  shopIds: [],
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

function mergeShopIds(existing: string[], next: string[]): string[] {
  const set = new Set(existing);
  for (const id of next) set.add(id);
  return Array.from(set);
}

function applyList(state: FollowState, list: FollowListResult) {
  state.items = list.items ?? [];
  state.page = list.page;
  state.pageSize = list.pageSize;
  state.totalCount = list.totalCount;
  state.totalPages = list.totalPages;
  state.shopIds = mergeShopIds(
    state.shopIds,
    (list.items ?? []).map((item) => item.shopId),
  );
  state.loaded = true;
  state.error = null;
}

export const fetchFollowedShops = createAsyncThunk<
  FollowListResult,
  FollowListQuery | undefined,
  { rejectValue: string }
>('follow/fetch', async (query, { rejectWithValue }) => {
  try {
    const result = await followApi.getFollowedShops(query);
    return requireData(result, 'Unable to load followed shops.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load followed shops.'));
  }
});

export const fetchFollowMembership = createAsyncThunk<
  FollowListResult,
  void,
  { rejectValue: string }
>('follow/fetchMembership', async (_, { rejectWithValue }) => {
  try {
    const result = await followApi.getFollowedShops({ page: 1, pageSize: 100 });
    return requireData(result, 'Unable to load followed shops.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load followed shops.'));
  }
});

export const followShop = createAsyncThunk<FollowedShop, string, { rejectValue: string }>(
  'follow/followShop',
  async (shopId, { rejectWithValue }) => {
    try {
      const result = await followApi.followShop({ shopId });
      return requireData(result, 'Unable to follow shop.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to follow shop.'));
    }
  },
);

export const unfollowShop = createAsyncThunk<
  UnfollowShopResponse,
  string,
  { rejectValue: string }
>('follow/unfollowShop', async (shopId, { rejectWithValue }) => {
  try {
    const result = await followApi.unfollowShop(shopId);
    return requireData(result, 'Unable to unfollow shop.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to unfollow shop.'));
  }
});

export const followSlice = createSlice({
  name: 'follow',
  initialState,
  reducers: {
    clearFollowState() {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchFollowedShops.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFollowedShops.fulfilled, (state, action) => {
        state.loading = false;
        applyList(state, action.payload);
      })
      .addCase(fetchFollowedShops.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to load followed shops.';
      })
      .addCase(fetchFollowMembership.fulfilled, (state, action) => {
        state.shopIds = (action.payload.items ?? []).map((item) => item.shopId);
        state.totalCount = action.payload.totalCount;
        state.membershipLoaded = true;
      })
      .addCase(fetchFollowMembership.rejected, (state) => {
        state.membershipLoaded = true;
      })
      .addCase(followShop.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(followShop.fulfilled, (state, action) => {
        state.mutating = false;
        const item = action.payload;
        if (!state.shopIds.includes(item.shopId)) {
          state.shopIds = [...state.shopIds, item.shopId];
          state.totalCount += 1;
        }
        const existingIndex = state.items.findIndex((row) => row.shopId === item.shopId);
        if (existingIndex >= 0) {
          state.items[existingIndex] = item;
        } else if (state.page === 1) {
          state.items = [item, ...state.items].slice(0, state.pageSize);
        }
      })
      .addCase(followShop.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to follow shop.';
      })
      .addCase(unfollowShop.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(unfollowShop.fulfilled, (state, action) => {
        state.mutating = false;
        const shopId = action.payload.shopId;
        state.items = state.items.filter((item) => item.shopId !== shopId);
        state.shopIds = state.shopIds.filter((id) => id !== shopId);
        state.totalCount = Math.max(0, state.totalCount - 1);
      })
      .addCase(unfollowShop.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to unfollow shop.';
      });
  },
});

export const { clearFollowState } = followSlice.actions;

export const selectFollow = (state: FollowRoot) => state.follow;
export const selectFollowedShops = (state: FollowRoot) => state.follow.items;
export const selectFollowedShopIds = (state: FollowRoot) => state.follow.shopIds;
export const selectFollowTotalCount = (state: FollowRoot) => state.follow.totalCount;
export const selectFollowLoading = (state: FollowRoot) => state.follow.loading;
export const selectFollowMutating = (state: FollowRoot) => state.follow.mutating;
export const selectFollowError = (state: FollowRoot) => state.follow.error;
export const selectFollowLoaded = (state: FollowRoot) => state.follow.loaded;
export const selectFollowMembershipLoaded = (state: FollowRoot) => state.follow.membershipLoaded;
export const selectIsFollowingShop = (shopId: string) => (state: FollowRoot) =>
  state.follow.shopIds.includes(shopId);
