import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import { fetchCart } from './cartSlice';
import * as orderApi from '../services/orderApi';
import * as paymentApi from '../services/paymentApi';
import type { CheckoutSuccessState, CreateOrderRequest, CreateOrderResponse, CreatedOrder } from '../types/order';
import type { OrderPaymentLink, SyncPayOsPaymentResponse } from '../types/payment';
import { getApiErrorMessage } from '../utils/apiError';
import {
  clearCheckoutSuccessStorage,
  loadCheckoutSuccess,
  saveCheckoutSuccess,
} from '../utils/checkoutStorage';

export type CheckoutState = {
  submitting: boolean;
  paying: boolean;
  /** A reconcile-with-payOS round trip is in flight. */
  syncing: boolean;
  error: string | null;
  lastSuccess: CheckoutSuccessState | null;
};

type CheckoutRoot = { checkout: CheckoutState };

const initialState: CheckoutState = {
  submitting: false,
  paying: false,
  syncing: false,
  error: null,
  lastSuccess: loadCheckoutSuccess(),
};

type CreateOrderThunkArg = {
  request: CreateOrderRequest;
  shipping: CheckoutSuccessState['shipping'];
  buyerNote?: string | null;
};

function toPaymentLink(
  order: CreatedOrder,
  data: {
    paymentId: string;
    checkoutUrl: string;
    providerPaymentId?: string | null;
    payOsOrderCode: number;
    paymentStatus: string;
    orderStatus: string;
    amount: number;
    currency: string;
  },
): OrderPaymentLink {
  return {
    orderId: order.orderId,
    orderCode: order.orderCode,
    paymentId: data.paymentId,
    checkoutUrl: data.checkoutUrl,
    providerPaymentId: data.providerPaymentId || '',
    payOsOrderCode: data.payOsOrderCode,
    paymentStatus: data.paymentStatus,
    orderStatus: data.orderStatus,
    amount: data.amount,
    currency: data.currency || order.currency || 'VND',
  };
}

export const placeOrder = createAsyncThunk<
  CheckoutSuccessState,
  CreateOrderThunkArg,
  { rejectValue: string }
>('checkout/placeOrder', async ({ request, shipping, buyerNote }, { dispatch, rejectWithValue }) => {
  try {
    const result = await orderApi.createOrder(request);
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Unable to create order.');
    }

    const data: CreateOrderResponse = result.data;
    await dispatch(fetchCart());

    const success: CheckoutSuccessState = {
      orders: data.orders ?? [],
      grandTotal: data.grandTotal,
      currency: data.currency || 'VND',
      buyerNote: buyerNote ?? null,
      shipping,
      payments: [],
    };
    saveCheckoutSuccess(success);
    return success;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to create order.'));
  }
});

export const createPayOsLinksForOrders = createAsyncThunk<
  OrderPaymentLink[],
  CreatedOrder[],
  { rejectValue: string; state: CheckoutRoot }
>('checkout/createPayOsLinks', async (orders, { getState, rejectWithValue }) => {
  try {
    const links: OrderPaymentLink[] = [];
    const errors: string[] = [];

    for (const order of orders) {
      try {
        const result = await paymentApi.createPayOsPayment({ orderId: order.orderId });
        if (!result.success || !result.data?.checkoutUrl) {
          errors.push(result.message || `Unable to create payment for ${order.orderCode}.`);
          continue;
        }
        links.push(toPaymentLink(order, result.data));
      } catch (error) {
        errors.push(getApiErrorMessage(error, `Unable to create payment for ${order.orderCode}.`));
      }
    }

    if (links.length === 0) {
      return rejectWithValue(errors[0] || 'Unable to create payment link.');
    }

    if (errors.length > 0 && links.length < orders.length) {
      console.warn('Some payOS links failed:', errors.join(' | '));
    }

    const current = getState().checkout.lastSuccess;
    if (current) {
      const existing = current.payments ?? [];
      const merged = [
        ...existing.filter((p) => !links.some((l) => l.orderId === p.orderId)),
        ...links,
      ];
      saveCheckoutSuccess({ ...current, payments: merged });
      return merged;
    }

    return links;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to create payment link.'));
  }
});

/**
 * Ask the API what payOS says about these orders. The payOS webhook is the
 * primary settlement path, but it never reaches a dev machine - without this the
 * buyer returns from a completed payment to an order still marked pending.
 * "Pay now" always calls create, which reuses a live link or mints a new one
 * after cancel/expire.
 */
export const syncPayOsPayments = createAsyncThunk<
  SyncPayOsPaymentResponse[],
  string[],
  { rejectValue: string; state: CheckoutRoot }
>('checkout/syncPayOsPayments', async (orderIds, { rejectWithValue }) => {
  try {
    const results: SyncPayOsPaymentResponse[] = [];

    for (const orderId of orderIds) {
      try {
        const result = await paymentApi.syncPayOsPayment({ orderId });
        if (result.success && result.data) results.push(result.data);
      } catch (error) {
        // One unreachable order should not hide the state of the others.
        console.warn('payOS sync failed for order', orderId, error);
      }
    }

    return results;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to check payment status.'));
  }
});

export const confirmMockPayOsReturn = createAsyncThunk<
  { orderId: string; paymentStatus: string; orderStatus: string },
  { orderId: string; paymentLinkId: string },
  { rejectValue: string; state: CheckoutRoot }
>('checkout/confirmMockPayOsReturn', async ({ orderId, paymentLinkId }, { getState, rejectWithValue }) => {
  try {
    const success = getState().checkout.lastSuccess ?? loadCheckoutSuccess();
    const payment = success?.payments?.find((p) => p.orderId === orderId);
    if (!payment) {
      return rejectWithValue('Payment details for this order were not found.');
    }

    const amount = Math.round(payment.amount);
    const result = await paymentApi.postPayOsWebhook({
      code: '00',
      description: 'success',
      success: true,
      signature: 'mock',
      data: {
        orderCode: payment.payOsOrderCode,
        amount,
        description: payment.orderCode,
        accountNumber: '00000000',
        reference: `MOCK-${payment.payOsOrderCode}`,
        transactionDateTime: new Date().toISOString(),
        currency: payment.currency || 'VND',
        paymentLinkId: paymentLinkId || payment.providerPaymentId,
        code: '00',
      },
    });

    if (!result.success || !result.data?.processed) {
      throw new Error(result.message || result.data?.message || 'Unable to confirm mock payment.');
    }

    return {
      orderId,
      paymentStatus: result.data.paymentStatus || 'Succeeded',
      orderStatus: result.data.orderStatus || 'Paid',
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to confirm mock payment.'));
  }
});

export const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    clearCheckoutError(state) {
      state.error = null;
    },
    clearCheckoutSuccess(state) {
      state.lastSuccess = null;
      clearCheckoutSuccessStorage();
    },
    hydrateCheckoutSuccess(state, action: PayloadAction<CheckoutSuccessState>) {
      state.lastSuccess = action.payload;
      saveCheckoutSuccess(action.payload);
    },
    markOrderPaidLocally(
      state,
      action: PayloadAction<{ orderId: string; paymentStatus: string; orderStatus: string }>,
    ) {
      if (!state.lastSuccess) return;
      const { orderId, paymentStatus, orderStatus } = action.payload;
      state.lastSuccess = {
        ...state.lastSuccess,
        orders: state.lastSuccess.orders.map((o) =>
          o.orderId === orderId ? { ...o, status: orderStatus, paymentStatus } : o,
        ),
        payments: (state.lastSuccess.payments ?? []).map((p) =>
          p.orderId === orderId ? { ...p, paymentStatus, orderStatus } : p,
        ),
      };
      saveCheckoutSuccess(state.lastSuccess);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => {
        clearCheckoutSuccessStorage();
        return { ...initialState, lastSuccess: null };
      })
      .addCase(placeOrder.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.submitting = false;
        state.lastSuccess = action.payload;
        state.error = null;
      })
      .addCase(placeOrder.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload ?? 'Unable to create order.';
      })
      .addCase(createPayOsLinksForOrders.pending, (state) => {
        state.paying = true;
        state.error = null;
      })
      .addCase(createPayOsLinksForOrders.fulfilled, (state, action) => {
        state.paying = false;
        if (state.lastSuccess) {
          const existing = state.lastSuccess.payments ?? [];
          const merged = [
            ...existing.filter((p) => !action.payload.some((l) => l.orderId === p.orderId)),
            ...action.payload,
          ];
          state.lastSuccess = { ...state.lastSuccess, payments: merged };
          saveCheckoutSuccess(state.lastSuccess);
        }
      })
      .addCase(createPayOsLinksForOrders.rejected, (state, action) => {
        state.paying = false;
        state.error = action.payload ?? 'Unable to create payment link.';
      })
      .addCase(syncPayOsPayments.pending, (state) => {
        state.syncing = true;
      })
      .addCase(syncPayOsPayments.fulfilled, (state, action) => {
        state.syncing = false;
        if (!state.lastSuccess || action.payload.length === 0) return;

        const byOrderId = new Map(action.payload.map((r) => [r.orderId, r]));
        state.lastSuccess = {
          ...state.lastSuccess,
          orders: state.lastSuccess.orders.map((o) => {
            const synced = byOrderId.get(o.orderId);
            return synced
              ? { ...o, status: synced.orderStatus, paymentStatus: synced.paymentStatus }
              : o;
          }),
          payments: (state.lastSuccess.payments ?? []).map((p) => {
            const synced = byOrderId.get(p.orderId);
            return synced
              ? { ...p, paymentStatus: synced.paymentStatus, orderStatus: synced.orderStatus }
              : p;
          }),
        };
        saveCheckoutSuccess(state.lastSuccess);
      })
      .addCase(syncPayOsPayments.rejected, (state) => {
        state.syncing = false;
      })
      .addCase(confirmMockPayOsReturn.fulfilled, (state, action) => {
        const { orderId, paymentStatus, orderStatus } = action.payload;
        if (!state.lastSuccess) return;
        state.lastSuccess = {
          ...state.lastSuccess,
          orders: state.lastSuccess.orders.map((o) =>
            o.orderId === orderId ? { ...o, status: orderStatus, paymentStatus } : o,
          ),
          payments: (state.lastSuccess.payments ?? []).map((p) =>
            p.orderId === orderId ? { ...p, paymentStatus, orderStatus } : p,
          ),
        };
        saveCheckoutSuccess(state.lastSuccess);
      });
  },
});

export const {
  clearCheckoutError,
  clearCheckoutSuccess,
  hydrateCheckoutSuccess,
  markOrderPaidLocally,
} = checkoutSlice.actions;

export const selectCheckout = (state: CheckoutRoot) => state.checkout;
export const selectCheckoutSubmitting = (state: CheckoutRoot) => state.checkout.submitting;
export const selectCheckoutPaying = (state: CheckoutRoot) => state.checkout.paying;
export const selectCheckoutSyncing = (state: CheckoutRoot) => state.checkout.syncing;
export const selectCheckoutError = (state: CheckoutRoot) => state.checkout.error;
export const selectCheckoutLastSuccess = (state: CheckoutRoot) => state.checkout.lastSuccess;
