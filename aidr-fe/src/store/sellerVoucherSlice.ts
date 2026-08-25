import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as voucherApi from '../services/voucherApi';
import type {
  CreateShopVoucherPayload,
  SellerShopVoucher,
  SellerShopVoucherListQuery,
  UpdateShopVoucherPayload,
} from '../types/seller';
import { getApiErrorMessage } from '../utils/apiError';

export type SellerShopVoucherSummary = {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  expiredCount: number;
};

export type SellerVoucherState = {
  items: SellerShopVoucher[];
  page: number;
  pageSize: number;
  totalCount: number;
  query: string;
  isActiveFilter: boolean | null;
  summary: SellerShopVoucherSummary;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
};

type SellerVoucherRoot = { sellerVoucher: SellerVoucherState };

const emptySummary: SellerShopVoucherSummary = {
  totalCount: 0,
  activeCount: 0,
  inactiveCount: 0,
  expiredCount: 0,
};

const initialState: SellerVoucherState = {
  items: [],
  page: 1,
  pageSize: 10,
  totalCount: 0,
  query: '',
  isActiveFilter: null,
  summary: emptySummary,
  loading: false,
  mutating: false,
  error: null,
  loaded: false,
};

function unwrap<T>(result: { success: boolean; data?: T; message?: string | null }, fallback: string): T {
  if (!result.success || result.data === undefined || result.data === null) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

function upsertItem(state: SellerVoucherState, item: SellerShopVoucher) {
  const index = state.items.findIndex((v) => v.voucherId === item.voucherId);
  if (index >= 0) state.items[index] = item;
  else state.items.unshift(item);
}

export const fetchSellerShopVouchers = createAsyncThunk(
  'sellerVoucher/list',
  async (query: SellerShopVoucherListQuery | undefined, { rejectWithValue }) => {
    try {
      const result = await voucherApi.listSellerShopVouchers(query ?? {});
      return unwrap(result, 'Unable to load vouchers.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load vouchers.'));
    }
  },
);

export const fetchSellerShopVoucher = createAsyncThunk(
  'sellerVoucher/get',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await voucherApi.getSellerShopVoucher(id);
      return unwrap(result, 'Unable to load voucher.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load voucher.'));
    }
  },
);

export const createSellerShopVoucher = createAsyncThunk(
  'sellerVoucher/create',
  async (payload: CreateShopVoucherPayload, { rejectWithValue }) => {
    try {
      const result = await voucherApi.createSellerShopVoucher(payload);
      return unwrap(result, 'Unable to create voucher.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create voucher.'));
    }
  },
);

export const updateSellerShopVoucher = createAsyncThunk(
  'sellerVoucher/update',
  async (
    { id, payload }: { id: string; payload: UpdateShopVoucherPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await voucherApi.updateSellerShopVoucher(id, payload);
      return unwrap(result, 'Unable to update voucher.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update voucher.'));
    }
  },
);

export const updateSellerShopVoucherStatus = createAsyncThunk(
  'sellerVoucher/status',
  async ({ id, isActive }: { id: string; isActive: boolean }, { rejectWithValue }) => {
    try {
      const result = await voucherApi.updateSellerShopVoucherStatus(id, isActive);
      return unwrap(result, 'Unable to update voucher status.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update voucher status.'));
    }
  },
);

export const deleteSellerShopVoucher = createAsyncThunk(
  'sellerVoucher/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await voucherApi.deleteSellerShopVoucher(id);
      if (!result.success) throw new Error(result.message || 'Unable to delete voucher.');
      return id;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to delete voucher.'));
    }
  },
);

export const sellerVoucherSlice = createSlice({
  name: 'sellerVoucher',
  initialState,
  reducers: {
    clearSellerVoucherError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchSellerShopVouchers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSellerShopVouchers.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload.items ?? [];
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.totalCount = action.payload.totalCount;
        state.summary = {
          totalCount: action.payload.totalCount,
          activeCount: action.payload.activeCount,
          inactiveCount: action.payload.inactiveCount,
          expiredCount: action.payload.expiredCount,
        };
      })
      .addCase(fetchSellerShopVouchers.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Unable to load vouchers.';
      })
      .addCase(fetchSellerShopVoucher.fulfilled, (state, action) => {
        upsertItem(state, action.payload);
      })
      .addCase(createSellerShopVoucher.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createSellerShopVoucher.fulfilled, (state, action) => {
        state.mutating = false;
        upsertItem(state, action.payload);
        state.totalCount += 1;
        if (action.payload.isActive) state.summary.activeCount += 1;
        else state.summary.inactiveCount += 1;
        state.summary.totalCount += 1;
      })
      .addCase(createSellerShopVoucher.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to create voucher.';
      })
      .addCase(updateSellerShopVoucher.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateSellerShopVoucher.fulfilled, (state, action) => {
        state.mutating = false;
        upsertItem(state, action.payload);
      })
      .addCase(updateSellerShopVoucher.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to update voucher.';
      })
      .addCase(updateSellerShopVoucherStatus.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateSellerShopVoucherStatus.fulfilled, (state, action) => {
        state.mutating = false;
        const previous = state.items.find((v) => v.voucherId === action.payload.voucherId);
        upsertItem(state, action.payload);
        if (previous && previous.isActive !== action.payload.isActive) {
          if (action.payload.isActive) {
            state.summary.activeCount += 1;
            state.summary.inactiveCount = Math.max(0, state.summary.inactiveCount - 1);
          } else {
            state.summary.inactiveCount += 1;
            state.summary.activeCount = Math.max(0, state.summary.activeCount - 1);
          }
        }
      })
      .addCase(updateSellerShopVoucherStatus.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to update voucher status.';
      })
      .addCase(deleteSellerShopVoucher.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteSellerShopVoucher.fulfilled, (state, action) => {
        state.mutating = false;
        const removed = state.items.find((v) => v.voucherId === action.payload);
        state.items = state.items.filter((v) => v.voucherId !== action.payload);
        state.totalCount = Math.max(0, state.totalCount - 1);
        state.summary.totalCount = Math.max(0, state.summary.totalCount - 1);
        if (removed?.isActive) state.summary.activeCount = Math.max(0, state.summary.activeCount - 1);
        else if (removed) state.summary.inactiveCount = Math.max(0, state.summary.inactiveCount - 1);
      })
      .addCase(deleteSellerShopVoucher.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to delete voucher.';
      });
  },
});

export const { clearSellerVoucherError } = sellerVoucherSlice.actions;

export const selectSellerShopVouchers = (state: SellerVoucherRoot) => state.sellerVoucher.items;
export const selectSellerShopVoucherPage = (state: SellerVoucherRoot) => state.sellerVoucher.page;
export const selectSellerShopVoucherPageSize = (state: SellerVoucherRoot) => state.sellerVoucher.pageSize;
export const selectSellerShopVoucherTotalCount = (state: SellerVoucherRoot) =>
  state.sellerVoucher.totalCount;
export const selectSellerShopVoucherSummary = (state: SellerVoucherRoot) => state.sellerVoucher.summary;
export const selectSellerShopVouchersLoading = (state: SellerVoucherRoot) => state.sellerVoucher.loading;
export const selectSellerShopVouchersMutating = (state: SellerVoucherRoot) =>
  state.sellerVoucher.mutating;
export const selectSellerShopVouchersError = (state: SellerVoucherRoot) => state.sellerVoucher.error;
export const selectSellerShopVoucherById = (id: string) => (state: SellerVoucherRoot) =>
  state.sellerVoucher.items.find((v) => v.voucherId === id);
