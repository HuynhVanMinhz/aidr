import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as sellerOrderApi from '../services/sellerOrderApi';
import type {
  SellerOrderDetail,
  SellerOrderListItem,
  SellerOrderListQuery,
  UpdateSellerOrderRequest,
} from '../types/sellerOrder';
import { getApiErrorMessage } from '../utils/apiError';

export type SellerOrdersListCache = {
  items: SellerOrderListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  status: string | null;
};

export type SellerOrdersState = {
  list: SellerOrdersListCache | null;
  listLoading: boolean;
  listError: string | null;
  detailById: Record<string, SellerOrderDetail>;
  detailLoadingId: string | null;
  detailError: string | null;
  mutating: boolean;
  mutateError: string | null;
};

type SellerOrdersRoot = { sellerOrders: SellerOrdersState };

const initialState: SellerOrdersState = {
  list: null,
  listLoading: false,
  listError: null,
  detailById: {},
  detailLoadingId: null,
  detailError: null,
  mutating: false,
  mutateError: null,
};

export const fetchSellerOrders = createAsyncThunk<
  SellerOrdersListCache,
  SellerOrderListQuery,
  { rejectValue: string }
>('sellerOrders/list', async (query, { rejectWithValue }) => {
  try {
    const result = await sellerOrderApi.listSellerOrders(query);
    const data = sellerOrderApi.requireSellerOrderList(result);
    return {
      items: data.items ?? [],
      page: data.page,
      pageSize: data.pageSize,
      totalCount: data.totalCount,
      totalPages: data.totalPages,
      status: query.status?.trim() || null,
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load orders.'));
  }
});

export const fetchSellerOrderDetail = createAsyncThunk<
  SellerOrderDetail,
  string,
  { rejectValue: string }
>('sellerOrders/detail', async (orderId, { rejectWithValue }) => {
  try {
    const result = await sellerOrderApi.getSellerOrder(orderId);
    return sellerOrderApi.requireSellerOrderDetail(result);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load order.'));
  }
});

export const updateSellerOrderStatus = createAsyncThunk<
  SellerOrderDetail,
  { orderId: string; request: UpdateSellerOrderRequest },
  { rejectValue: string }
>('sellerOrders/updateStatus', async ({ orderId, request }, { rejectWithValue }) => {
  try {
    const result = await sellerOrderApi.updateSellerOrderStatus(orderId, request);
    return sellerOrderApi.requireSellerOrderDetail(result);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to update order status.'));
  }
});

function upsertListItem(state: SellerOrdersState, detail: SellerOrderDetail) {
  if (!state.list) return;
  const idx = state.list.items.findIndex((item) => item.orderId === detail.orderId);
  if (idx < 0) return;

  const prev = state.list.items[idx];
  state.list.items[idx] = {
    ...prev,
    status: detail.status,
    subtotalAmount: detail.subtotalAmount,
    discountAmount: detail.discountAmount,
    shippingFee: detail.shippingFee,
    totalAmount: detail.totalAmount,
    currency: detail.currency,
    itemCount: detail.items.reduce((sum, item) => sum + item.quantity, 0),
    trackingCode: detail.trackingCode,
    paidAt: detail.paidAt,
    cancelledAt: detail.cancelledAt,
    deliveredAt: detail.deliveredAt,
    completedAt: detail.completedAt,
    canUpdateStatus: detail.canUpdateStatus,
    nextStatus: detail.nextStatus,
  };
}

export const sellerOrdersSlice = createSlice({
  name: 'sellerOrders',
  initialState,
  reducers: {
    clearSellerOrderDetailError(state) {
      state.detailError = null;
      state.mutateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => initialState)
      .addCase(fetchSellerOrders.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchSellerOrders.fulfilled, (state, action) => {
        state.listLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchSellerOrders.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload ?? 'Unable to load orders.';
      })
      .addCase(fetchSellerOrderDetail.pending, (state, action) => {
        state.detailLoadingId = action.meta.arg;
        state.detailError = null;
      })
      .addCase(fetchSellerOrderDetail.fulfilled, (state, action) => {
        state.detailLoadingId = null;
        state.detailById[action.payload.orderId] = action.payload;
      })
      .addCase(fetchSellerOrderDetail.rejected, (state, action) => {
        state.detailLoadingId = null;
        state.detailError = action.payload ?? 'Unable to load order.';
      })
      .addCase(updateSellerOrderStatus.pending, (state) => {
        state.mutating = true;
        state.mutateError = null;
      })
      .addCase(updateSellerOrderStatus.fulfilled, (state, action) => {
        state.mutating = false;
        state.detailById[action.payload.orderId] = action.payload;
        upsertListItem(state, action.payload);
      })
      .addCase(updateSellerOrderStatus.rejected, (state, action) => {
        state.mutating = false;
        state.mutateError = action.payload ?? 'Unable to update order status.';
      });
  },
});

export const { clearSellerOrderDetailError } = sellerOrdersSlice.actions;

export const selectSellerOrdersState = (state: SellerOrdersRoot) => state.sellerOrders;
export const selectSellerOrdersList = (state: SellerOrdersRoot) => state.sellerOrders.list;
export const selectSellerOrdersListLoading = (state: SellerOrdersRoot) =>
  state.sellerOrders.listLoading;
export const selectSellerOrdersListError = (state: SellerOrdersRoot) => state.sellerOrders.listError;
export const selectSellerOrderDetail = (orderId: string) => (state: SellerOrdersRoot) =>
  state.sellerOrders.detailById[orderId] ?? null;
export const selectSellerOrdersDetailLoadingId = (state: SellerOrdersRoot) =>
  state.sellerOrders.detailLoadingId;
export const selectSellerOrdersDetailError = (state: SellerOrdersRoot) =>
  state.sellerOrders.detailError;
export const selectSellerOrdersMutating = (state: SellerOrdersRoot) => state.sellerOrders.mutating;
export const selectSellerOrdersMutateError = (state: SellerOrdersRoot) =>
  state.sellerOrders.mutateError;
