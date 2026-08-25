import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as orderApi from '../services/orderApi';
import type {
  BuyerOrderDetail,
  BuyerOrderListItem,
  BuyerOrderListQuery,
  CancelOrderRequest,
} from '../types/order';
import { getApiErrorMessage } from '../utils/apiError';

export type OrdersListCache = {
  items: BuyerOrderListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  status: string | null;
};

export type OrdersState = {
  list: OrdersListCache | null;
  listLoading: boolean;
  listError: string | null;
  detailById: Record<string, BuyerOrderDetail>;
  detailLoadingId: string | null;
  detailError: string | null;
  mutating: boolean;
  mutateError: string | null;
};

type OrdersRoot = { orders: OrdersState };

const initialState: OrdersState = {
  list: null,
  listLoading: false,
  listError: null,
  detailById: {},
  detailLoadingId: null,
  detailError: null,
  mutating: false,
  mutateError: null,
};

export const fetchBuyerOrders = createAsyncThunk<
  OrdersListCache,
  BuyerOrderListQuery,
  { rejectValue: string }
>('orders/list', async (query, { rejectWithValue }) => {
  try {
    const result = await orderApi.listBuyerOrders(query);
    const data = orderApi.requireBuyerOrderList(result);
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

export const fetchBuyerOrderDetail = createAsyncThunk<
  BuyerOrderDetail,
  string,
  { rejectValue: string }
>('orders/detail', async (orderId, { rejectWithValue }) => {
  try {
    const result = await orderApi.getBuyerOrder(orderId);
    return orderApi.requireBuyerOrderDetail(result);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load order.'));
  }
});

export const cancelBuyerOrder = createAsyncThunk<
  BuyerOrderDetail,
  { orderId: string; reason?: string | null },
  { rejectValue: string }
>('orders/cancel', async ({ orderId, reason }, { rejectWithValue }) => {
  try {
    const body: CancelOrderRequest = { reason: reason?.trim() || null };
    const result = await orderApi.cancelBuyerOrder(orderId, body);
    return orderApi.requireBuyerOrderDetail(result);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to cancel order.'));
  }
});

export const confirmBuyerOrderReceived = createAsyncThunk<
  BuyerOrderDetail,
  string,
  { rejectValue: string }
>('orders/confirmReceived', async (orderId, { rejectWithValue }) => {
  try {
    const result = await orderApi.confirmBuyerOrderReceived(orderId);
    return orderApi.requireBuyerOrderDetail(result);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to confirm order received.'));
  }
});

function upsertListItem(state: OrdersState, detail: BuyerOrderDetail) {
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
  };
}

export const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearOrdersState() {
      return { ...initialState };
    },
    clearOrdersDetailError(state) {
      state.detailError = null;
    },
    clearOrdersMutateError(state) {
      state.mutateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchBuyerOrders.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchBuyerOrders.fulfilled, (state, action) => {
        state.listLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchBuyerOrders.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload ?? 'Unable to load orders.';
      })
      .addCase(fetchBuyerOrderDetail.pending, (state, action) => {
        state.detailLoadingId = action.meta.arg;
        state.detailError = null;
      })
      .addCase(fetchBuyerOrderDetail.fulfilled, (state, action) => {
        state.detailLoadingId = null;
        state.detailById[action.payload.orderId] = action.payload;
      })
      .addCase(fetchBuyerOrderDetail.rejected, (state, action) => {
        state.detailLoadingId = null;
        state.detailError = action.payload ?? 'Unable to load order.';
      })
      .addCase(cancelBuyerOrder.pending, (state) => {
        state.mutating = true;
        state.mutateError = null;
      })
      .addCase(cancelBuyerOrder.fulfilled, (state, action) => {
        state.mutating = false;
        state.detailById[action.payload.orderId] = action.payload;
        upsertListItem(state, action.payload);
      })
      .addCase(cancelBuyerOrder.rejected, (state, action) => {
        state.mutating = false;
        state.mutateError = action.payload ?? 'Unable to cancel order.';
      })
      .addCase(confirmBuyerOrderReceived.pending, (state) => {
        state.mutating = true;
        state.mutateError = null;
      })
      .addCase(confirmBuyerOrderReceived.fulfilled, (state, action) => {
        state.mutating = false;
        state.detailById[action.payload.orderId] = action.payload;
        upsertListItem(state, action.payload);
      })
      .addCase(confirmBuyerOrderReceived.rejected, (state, action) => {
        state.mutating = false;
        state.mutateError = action.payload ?? 'Unable to confirm order received.';
      });
  },
});

export const { clearOrdersState, clearOrdersDetailError, clearOrdersMutateError } =
  ordersSlice.actions;

export const selectOrdersState = (state: OrdersRoot) => state.orders;
export const selectOrdersList = (state: OrdersRoot) => state.orders.list;
export const selectOrdersListLoading = (state: OrdersRoot) => state.orders.listLoading;
export const selectOrdersListError = (state: OrdersRoot) => state.orders.listError;
export const selectOrderDetail = (orderId: string) => (state: OrdersRoot) =>
  state.orders.detailById[orderId] ?? null;
export const selectOrdersDetailLoadingId = (state: OrdersRoot) => state.orders.detailLoadingId;
export const selectOrdersDetailError = (state: OrdersRoot) => state.orders.detailError;
export const selectOrdersMutating = (state: OrdersRoot) => state.orders.mutating;
export const selectOrdersMutateError = (state: OrdersRoot) => state.orders.mutateError;
