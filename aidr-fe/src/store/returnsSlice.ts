import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as returnApi from '../services/returnApi';
import type { BuyerReturnRequest, CreateReturnPayload } from '../types/return';
import { getApiErrorMessage } from '../utils/apiError';

export type ReturnsState = {
  byOrderId: Record<string, BuyerReturnRequest>;
  /** Explicitly loaded but no return exists for the order. */
  missingOrderIds: Record<string, true>;
  loadingOrderId: string | null;
  mutating: boolean;
  error: string | null;
};

type ReturnsRoot = { returns: ReturnsState };

const initialState: ReturnsState = {
  byOrderId: {},
  missingOrderIds: {},
  loadingOrderId: null,
  mutating: false,
  error: null,
};

export const fetchBuyerReturn = createAsyncThunk(
  'returns/fetchBuyerReturn',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const result = await returnApi.getBuyerReturn(orderId);
      if (result == null) {
        return { orderId, returnRequest: null as BuyerReturnRequest | null };
      }
      return {
        orderId,
        returnRequest: returnApi.requireBuyerReturn(result),
      };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load return request.'));
    }
  },
);

export const createBuyerReturn = createAsyncThunk(
  'returns/createBuyerReturn',
  async (
    { orderId, payload }: { orderId: string; payload: CreateReturnPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await returnApi.createBuyerReturn(orderId, payload);
      return {
        orderId,
        returnRequest: returnApi.requireBuyerReturn(result),
      };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to submit return request.'));
    }
  },
);

export const returnsSlice = createSlice({
  name: 'returns',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => initialState)
      .addCase(fetchBuyerReturn.pending, (state, action) => {
        state.loadingOrderId = action.meta.arg;
        state.error = null;
      })
      .addCase(fetchBuyerReturn.fulfilled, (state, action) => {
        state.loadingOrderId = null;
        const { orderId, returnRequest } = action.payload;
        if (returnRequest) {
          state.byOrderId[orderId] = returnRequest;
          delete state.missingOrderIds[orderId];
        } else {
          delete state.byOrderId[orderId];
          state.missingOrderIds[orderId] = true;
        }
      })
      .addCase(fetchBuyerReturn.rejected, (state, action) => {
        state.loadingOrderId = null;
        state.error = (action.payload as string) || 'Unable to load return request.';
      })
      .addCase(createBuyerReturn.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createBuyerReturn.fulfilled, (state, action) => {
        state.mutating = false;
        const { orderId, returnRequest } = action.payload;
        state.byOrderId[orderId] = returnRequest;
        delete state.missingOrderIds[orderId];
      })
      .addCase(createBuyerReturn.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to submit return request.';
      });
  },
});

export const selectBuyerReturnByOrderId = (orderId: string) => (state: ReturnsRoot) =>
  state.returns.byOrderId[orderId] ?? null;

export const selectBuyerReturnMissing = (orderId: string) => (state: ReturnsRoot) =>
  Boolean(state.returns.missingOrderIds[orderId]);

export const selectReturnsLoadingOrderId = (state: ReturnsRoot) => state.returns.loadingOrderId;
export const selectReturnsMutating = (state: ReturnsRoot) => state.returns.mutating;
export const selectReturnsError = (state: ReturnsRoot) => state.returns.error;
