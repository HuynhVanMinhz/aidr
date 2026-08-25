import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as voucherApi from '../services/voucherApi';
import type {
  AdminSystemVoucher,
  AdminSystemVoucherListQuery,
  CreateSystemVoucherPayload,
  UpdateSystemVoucherPayload,
} from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export type AdminSystemVoucherSummary = {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  expiredCount: number;
};

export type AdminVoucherState = {
  items: AdminSystemVoucher[];
  page: number;
  pageSize: number;
  totalCount: number;
  query: string;
  isActiveFilter: boolean | null;
  summary: AdminSystemVoucherSummary;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
};

type AdminVoucherRoot = { adminVoucher: AdminVoucherState };

const emptySummary: AdminSystemVoucherSummary = {
  totalCount: 0,
  activeCount: 0,
  inactiveCount: 0,
  expiredCount: 0,
};

const initialState: AdminVoucherState = {
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

function upsertItem(state: AdminVoucherState, item: AdminSystemVoucher) {
  const index = state.items.findIndex((v) => v.voucherId === item.voucherId);
  if (index >= 0) state.items[index] = item;
  else state.items.unshift(item);
}

export const fetchAdminSystemVouchers = createAsyncThunk(
  'adminVoucher/list',
  async (query: AdminSystemVoucherListQuery | undefined, { rejectWithValue }) => {
    try {
      const result = await voucherApi.listAdminSystemVouchers(query ?? {});
      return unwrap(result, 'Unable to load vouchers.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load vouchers.'));
    }
  },
);

export const fetchAdminSystemVoucher = createAsyncThunk(
  'adminVoucher/get',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await voucherApi.getAdminSystemVoucher(id);
      return unwrap(result, 'Unable to load voucher.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load voucher.'));
    }
  },
);

export const createAdminSystemVoucher = createAsyncThunk(
  'adminVoucher/create',
  async (payload: CreateSystemVoucherPayload, { rejectWithValue }) => {
    try {
      const result = await voucherApi.createAdminSystemVoucher(payload);
      return unwrap(result, 'Unable to create voucher.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create voucher.'));
    }
  },
);

export const updateAdminSystemVoucher = createAsyncThunk(
  'adminVoucher/update',
  async (
    { id, payload }: { id: string; payload: UpdateSystemVoucherPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await voucherApi.updateAdminSystemVoucher(id, payload);
      return unwrap(result, 'Unable to update voucher.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update voucher.'));
    }
  },
);

export const updateAdminSystemVoucherStatus = createAsyncThunk(
  'adminVoucher/status',
  async ({ id, isActive }: { id: string; isActive: boolean }, { rejectWithValue }) => {
    try {
      const result = await voucherApi.updateAdminSystemVoucherStatus(id, isActive);
      return unwrap(result, 'Unable to update voucher status.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update voucher status.'));
    }
  },
);

export const deleteAdminSystemVoucher = createAsyncThunk(
  'adminVoucher/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await voucherApi.deleteAdminSystemVoucher(id);
      if (!result.success) throw new Error(result.message || 'Unable to delete voucher.');
      return id;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to delete voucher.'));
    }
  },
);

export const adminVoucherSlice = createSlice({
  name: 'adminVoucher',
  initialState,
  reducers: {
    clearAdminVoucherError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchAdminSystemVouchers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminSystemVouchers.fulfilled, (state, action) => {
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
      .addCase(fetchAdminSystemVouchers.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Unable to load vouchers.';
      })
      .addCase(fetchAdminSystemVoucher.fulfilled, (state, action) => {
        upsertItem(state, action.payload);
      })
      .addCase(createAdminSystemVoucher.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createAdminSystemVoucher.fulfilled, (state, action) => {
        state.mutating = false;
        upsertItem(state, action.payload);
        state.totalCount += 1;
        if (action.payload.isActive) state.summary.activeCount += 1;
        else state.summary.inactiveCount += 1;
        state.summary.totalCount += 1;
      })
      .addCase(createAdminSystemVoucher.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to create voucher.';
      })
      .addCase(updateAdminSystemVoucher.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateAdminSystemVoucher.fulfilled, (state, action) => {
        state.mutating = false;
        upsertItem(state, action.payload);
      })
      .addCase(updateAdminSystemVoucher.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to update voucher.';
      })
      .addCase(updateAdminSystemVoucherStatus.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateAdminSystemVoucherStatus.fulfilled, (state, action) => {
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
      .addCase(updateAdminSystemVoucherStatus.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to update voucher status.';
      })
      .addCase(deleteAdminSystemVoucher.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteAdminSystemVoucher.fulfilled, (state, action) => {
        state.mutating = false;
        const removed = state.items.find((v) => v.voucherId === action.payload);
        state.items = state.items.filter((v) => v.voucherId !== action.payload);
        state.totalCount = Math.max(0, state.totalCount - 1);
        state.summary.totalCount = Math.max(0, state.summary.totalCount - 1);
        if (removed?.isActive) state.summary.activeCount = Math.max(0, state.summary.activeCount - 1);
        else if (removed) state.summary.inactiveCount = Math.max(0, state.summary.inactiveCount - 1);
      })
      .addCase(deleteAdminSystemVoucher.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to delete voucher.';
      });
  },
});

export const { clearAdminVoucherError } = adminVoucherSlice.actions;

export const selectAdminSystemVouchers = (state: AdminVoucherRoot) => state.adminVoucher.items;
export const selectAdminSystemVoucherPage = (state: AdminVoucherRoot) => state.adminVoucher.page;
export const selectAdminSystemVoucherPageSize = (state: AdminVoucherRoot) => state.adminVoucher.pageSize;
export const selectAdminSystemVoucherTotalCount = (state: AdminVoucherRoot) =>
  state.adminVoucher.totalCount;
export const selectAdminSystemVoucherSummary = (state: AdminVoucherRoot) => state.adminVoucher.summary;
export const selectAdminSystemVouchersLoading = (state: AdminVoucherRoot) => state.adminVoucher.loading;
export const selectAdminSystemVouchersMutating = (state: AdminVoucherRoot) =>
  state.adminVoucher.mutating;
export const selectAdminSystemVouchersError = (state: AdminVoucherRoot) => state.adminVoucher.error;
export const selectAdminSystemVoucherById = (id: string) => (state: AdminVoucherRoot) =>
  state.adminVoucher.items.find((v) => v.voucherId === id);
