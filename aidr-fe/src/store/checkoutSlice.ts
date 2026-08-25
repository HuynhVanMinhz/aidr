import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import { fetchCart } from './cartSlice';
import * as orderApi from '../services/orderApi';
import type { CheckoutSuccessState, CreateOrderRequest, CreateOrderResponse } from '../types/order';
import { getApiErrorMessage } from '../utils/apiError';

export type CheckoutState = {
  submitting: boolean;
  error: string | null;
  lastSuccess: CheckoutSuccessState | null;
};

type CheckoutRoot = { checkout: CheckoutState };

const initialState: CheckoutState = {
  submitting: false,
  error: null,
  lastSuccess: null,
};

type CreateOrderThunkArg = {
  request: CreateOrderRequest;
  shipping: CheckoutSuccessState['shipping'];
  buyerNote?: string | null;
};

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

    return {
      orders: data.orders ?? [],
      grandTotal: data.grandTotal,
      currency: data.currency || 'VND',
      buyerNote: buyerNote ?? null,
      shipping,
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to create order.'));
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
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
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
      });
  },
});

export const { clearCheckoutError, clearCheckoutSuccess } = checkoutSlice.actions;

export const selectCheckout = (state: CheckoutRoot) => state.checkout;
export const selectCheckoutSubmitting = (state: CheckoutRoot) => state.checkout.submitting;
export const selectCheckoutError = (state: CheckoutRoot) => state.checkout.error;
export const selectCheckoutLastSuccess = (state: CheckoutRoot) => state.checkout.lastSuccess;
