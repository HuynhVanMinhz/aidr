import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import {
  addCartItem,
  clearCartItems,
  removeCartItem,
  updateCartItemQty,
} from './cartSlice';
import * as voucherApi from '../services/voucherApi';
import type {
  AppliedVoucher,
  ApplyVoucherPreview,
  ApplyVoucherPreviewRequest,
  VoucherListItem,
  VoucherListQuery,
} from '../types/voucher';
import { getApiErrorMessage } from '../utils/apiError';

export type VoucherState = {
  items: VoucherListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  cartSubtotal: number;
  currency: string;
  loading: boolean;
  previewing: boolean;
  error: string | null;
  previewError: string | null;
  loaded: boolean;
  /** One applied voucher per shop order. */
  appliedByShopId: Record<string, AppliedVoucher>;
  codeInput: string;
};

type VoucherRoot = { voucher: VoucherState };

const initialState: VoucherState = {
  items: [],
  page: 1,
  pageSize: 20,
  totalCount: 0,
  cartSubtotal: 0,
  currency: 'VND',
  loading: false,
  previewing: false,
  error: null,
  previewError: null,
  loaded: false,
  appliedByShopId: {},
  codeInput: '',
};

function toApplied(preview: ApplyVoucherPreview): AppliedVoucher {
  return {
    shopId: preview.applicableShopId,
    shopName: preview.shopName,
    voucherId: preview.voucherId,
    code: preview.code,
    name: preview.name,
    scope: preview.scope,
    discountAmount: preview.discountAmount,
    subtotalAmount: preview.subtotalAmount,
    totalAmount: preview.totalAmount,
    currency: preview.currency || 'VND',
  };
}

export const fetchVouchers = createAsyncThunk<
  {
    items: VoucherListItem[];
    page: number;
    pageSize: number;
    totalCount: number;
    cartSubtotal: number;
    currency: string;
  },
  VoucherListQuery | undefined,
  { rejectValue: string }
>('voucher/fetchList', async (query, { rejectWithValue }) => {
  try {
    const result = await voucherApi.listVouchers(query);
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Unable to load vouchers.');
    }
    return {
      items: result.data.items ?? [],
      page: result.data.page,
      pageSize: result.data.pageSize,
      totalCount: result.data.totalCount,
      cartSubtotal: result.data.cartSubtotal,
      currency: result.data.currency || 'VND',
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load vouchers.'));
  }
});

export const previewAndApplyVoucher = createAsyncThunk<
  AppliedVoucher,
  ApplyVoucherPreviewRequest,
  { rejectValue: string }
>('voucher/previewAndApply', async (request, { rejectWithValue }) => {
  try {
    const result = await voucherApi.previewVoucher(request);
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Unable to apply voucher.');
    }
    if (!result.data.isValid) {
      throw new Error(result.data.message || 'Voucher cannot be applied.');
    }
    return toApplied(result.data);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to apply voucher.'));
  }
});

export const refreshAppliedVouchers = createAsyncThunk<
  AppliedVoucher[],
  { cartItemIds?: string[] | null } | undefined,
  { state: VoucherRoot; rejectValue: string }
>('voucher/refreshApplied', async (args, { getState, rejectWithValue }) => {
  const applied = Object.values(getState().voucher.appliedByShopId);
  if (applied.length === 0) return [];

  const next: AppliedVoucher[] = [];
  const errors: string[] = [];

  for (const current of applied) {
    try {
      const result = await voucherApi.previewVoucher({
        voucherId: current.voucherId,
        shopId: current.shopId,
        cartItemIds: args?.cartItemIds,
      });
      if (!result.success || !result.data?.isValid) {
        errors.push(result.data?.message || result.message || `${current.code} is no longer valid.`);
        continue;
      }
      next.push(toApplied(result.data));
    } catch (error) {
      errors.push(getApiErrorMessage(error, `${current.code} is no longer valid.`));
    }
  }

  if (next.length === 0 && errors.length > 0) {
    return rejectWithValue(errors[0]);
  }

  return next;
});

export const voucherSlice = createSlice({
  name: 'voucher',
  initialState,
  reducers: {
    setVoucherCodeInput(state, action: PayloadAction<string>) {
      state.codeInput = action.payload;
      state.previewError = null;
    },
    removeAppliedVoucher(state, action: PayloadAction<string>) {
      delete state.appliedByShopId[action.payload];
      state.previewError = null;
    },
    clearAppliedVouchers(state) {
      state.appliedByShopId = {};
      state.previewError = null;
      state.codeInput = '';
    },
    clearVoucherState() {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(clearCartItems.fulfilled, (state) => {
        state.appliedByShopId = {};
        state.items = [];
        state.loaded = false;
        state.codeInput = '';
      })
      .addCase(addCartItem.fulfilled, (state) => {
        state.loaded = false;
      })
      .addCase(updateCartItemQty.fulfilled, (state) => {
        state.loaded = false;
      })
      .addCase(removeCartItem.fulfilled, (state) => {
        state.loaded = false;
      })
      .addCase(fetchVouchers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVouchers.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.totalCount = action.payload.totalCount;
        state.cartSubtotal = action.payload.cartSubtotal;
        state.currency = action.payload.currency;
      })
      .addCase(fetchVouchers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to load vouchers.';
      })
      .addCase(previewAndApplyVoucher.pending, (state) => {
        state.previewing = true;
        state.previewError = null;
      })
      .addCase(previewAndApplyVoucher.fulfilled, (state, action) => {
        state.previewing = false;
        state.appliedByShopId[action.payload.shopId] = action.payload;
        state.codeInput = '';
      })
      .addCase(previewAndApplyVoucher.rejected, (state, action) => {
        state.previewing = false;
        state.previewError = action.payload ?? 'Unable to apply voucher.';
      })
      .addCase(refreshAppliedVouchers.fulfilled, (state, action) => {
        const map: Record<string, AppliedVoucher> = {};
        for (const item of action.payload) {
          map[item.shopId] = item;
        }
        state.appliedByShopId = map;
      })
      .addCase(refreshAppliedVouchers.rejected, (state, action) => {
        state.appliedByShopId = {};
        state.previewError = action.payload ?? null;
      });
  },
});

export const {
  setVoucherCodeInput,
  removeAppliedVoucher,
  clearAppliedVouchers,
  clearVoucherState,
} = voucherSlice.actions;

export const selectVoucher = (state: VoucherRoot) => state.voucher;
export const selectVoucherItems = (state: VoucherRoot) => state.voucher.items;
export const selectAppliedVouchers = (state: VoucherRoot) =>
  Object.values(state.voucher.appliedByShopId);
export const selectAppliedDiscountTotal = (state: VoucherRoot) =>
  Object.values(state.voucher.appliedByShopId).reduce((sum, v) => sum + v.discountAmount, 0);
export const selectVoucherLoading = (state: VoucherRoot) => state.voucher.loading;
export const selectVoucherPreviewing = (state: VoucherRoot) => state.voucher.previewing;
export const selectVoucherError = (state: VoucherRoot) => state.voucher.error;
export const selectVoucherPreviewError = (state: VoucherRoot) => state.voucher.previewError;
export const selectVoucherCodeInput = (state: VoucherRoot) => state.voucher.codeInput;
export const selectVoucherLoaded = (state: VoucherRoot) => state.voucher.loaded;
