import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as returnApi from '../services/returnApi';
import type {
  AdminReturnDetail,
  AdminReturnListItem,
  AdminReturnListQuery,
  AdminReturnStatusFilter,
  RejectReturnPayload,
  UpdateReturnStatusPayload,
} from '../types/return';
import { getApiErrorMessage } from '../utils/apiError';

export type AdminReturnSummary = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  receivingCount: number;
  refundedCount: number;
  closedCount: number;
};

export type AdminReturnsState = {
  items: AdminReturnListItem[];
  detailsById: Record<string, AdminReturnDetail>;
  filter: AdminReturnStatusFilter;
  page: number;
  pageSize: number;
  totalCount: number;
  query: string;
  summary: AdminReturnSummary;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
};

type AdminReturnsRoot = { adminReturns: AdminReturnsState };

const emptySummary: AdminReturnSummary = {
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  receivingCount: 0,
  refundedCount: 0,
  closedCount: 0,
};

const initialState: AdminReturnsState = {
  items: [],
  detailsById: {},
  filter: 'Pending',
  page: 1,
  pageSize: 10,
  totalCount: 0,
  query: '',
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

function upsertListItem(state: AdminReturnsState, detail: AdminReturnDetail) {
  const listItem: AdminReturnListItem = {
    returnRequestId: detail.returnRequestId,
    orderId: detail.orderId,
    orderCode: detail.orderCode,
    shopId: detail.shopId,
    shopName: detail.shopName,
    buyerUserId: detail.buyerUserId,
    buyerEmail: detail.buyerEmail,
    buyerFullName: detail.buyerFullName,
    reason: detail.reason,
    status: detail.status,
    resolutionType: detail.resolutionType,
    refundAmount: detail.refundAmount,
    orderTotalAmount: detail.orderTotalAmount,
    evidenceCount: detail.evidences.length,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };

  const filter = state.filter;
  const matchesFilter =
    filter === 'all' || filter.toLowerCase() === String(detail.status).toLowerCase();

  if (!matchesFilter) {
    state.items = state.items.filter((i) => i.returnRequestId !== detail.returnRequestId);
  } else {
    const index = state.items.findIndex((i) => i.returnRequestId === detail.returnRequestId);
    if (index >= 0) state.items[index] = listItem;
    else state.items.unshift(listItem);
  }

  state.detailsById[detail.returnRequestId] = detail;
}

export const fetchAdminReturns = createAsyncThunk(
  'adminReturns/list',
  async (query: AdminReturnListQuery | undefined, { rejectWithValue }) => {
    try {
      const params: AdminReturnListQuery = {
        status: query?.status ?? 'Pending',
        q: query?.q ?? '',
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 10,
      };
      const result = await returnApi.listAdminReturns(params);
      const data = unwrap(result, 'Unable to load return requests.');
      return {
        ...data,
        status: (params.status ?? 'Pending') as AdminReturnStatusFilter,
        q: params.q ?? '',
      };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load return requests.'));
    }
  },
);

export const fetchAdminReturn = createAsyncThunk(
  'adminReturns/get',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await returnApi.getAdminReturn(id);
      return unwrap(result, 'Unable to load return request.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load return request.'));
    }
  },
);

export const approveAdminReturn = createAsyncThunk(
  'adminReturns/approve',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await returnApi.approveAdminReturn(id);
      return unwrap(result, 'Unable to approve return request.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to approve return request.'));
    }
  },
);

export const rejectAdminReturn = createAsyncThunk(
  'adminReturns/reject',
  async (
    { id, payload }: { id: string; payload: RejectReturnPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await returnApi.rejectAdminReturn(id, payload);
      return unwrap(result, 'Unable to reject return request.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to reject return request.'));
    }
  },
);

export const updateAdminReturnStatus = createAsyncThunk(
  'adminReturns/updateStatus',
  async (
    { id, payload }: { id: string; payload: UpdateReturnStatusPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await returnApi.updateAdminReturnStatus(id, payload);
      return unwrap(result, 'Unable to update return status.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update return status.'));
    }
  },
);

export const adminReturnsSlice = createSlice({
  name: 'adminReturns',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => initialState)
      .addCase(fetchAdminReturns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminReturns.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload.items;
        state.filter = action.payload.status;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.totalCount = action.payload.totalCount;
        state.query = action.payload.q;
        state.summary = {
          pendingCount: action.payload.pendingCount,
          approvedCount: action.payload.approvedCount,
          rejectedCount: action.payload.rejectedCount,
          receivingCount: action.payload.receivingCount,
          refundedCount: action.payload.refundedCount,
          closedCount: action.payload.closedCount,
        };
      })
      .addCase(fetchAdminReturns.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = (action.payload as string) || 'Unable to load return requests.';
      })
      .addCase(fetchAdminReturn.fulfilled, (state, action) => {
        upsertListItem(state, action.payload);
      })
      .addCase(approveAdminReturn.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(approveAdminReturn.fulfilled, (state, action) => {
        state.mutating = false;
        upsertListItem(state, action.payload);
      })
      .addCase(approveAdminReturn.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to approve return request.';
      })
      .addCase(rejectAdminReturn.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(rejectAdminReturn.fulfilled, (state, action) => {
        state.mutating = false;
        upsertListItem(state, action.payload);
      })
      .addCase(rejectAdminReturn.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to reject return request.';
      })
      .addCase(updateAdminReturnStatus.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateAdminReturnStatus.fulfilled, (state, action) => {
        state.mutating = false;
        upsertListItem(state, action.payload);
      })
      .addCase(updateAdminReturnStatus.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to update return status.';
      });
  },
});

export const selectAdminReturns = (state: AdminReturnsRoot) => state.adminReturns.items;
export const selectAdminReturnsFilter = (state: AdminReturnsRoot) => state.adminReturns.filter;
export const selectAdminReturnsPage = (state: AdminReturnsRoot) => state.adminReturns.page;
export const selectAdminReturnsPageSize = (state: AdminReturnsRoot) => state.adminReturns.pageSize;
export const selectAdminReturnsTotalCount = (state: AdminReturnsRoot) =>
  state.adminReturns.totalCount;
export const selectAdminReturnsSummary = (state: AdminReturnsRoot) => state.adminReturns.summary;
export const selectAdminReturnsLoading = (state: AdminReturnsRoot) => state.adminReturns.loading;
export const selectAdminReturnsMutating = (state: AdminReturnsRoot) => state.adminReturns.mutating;
export const selectAdminReturnsError = (state: AdminReturnsRoot) => state.adminReturns.error;
export const selectAdminReturnsLoaded = (state: AdminReturnsRoot) => state.adminReturns.loaded;
export const selectAdminReturnById = (id: string) => (state: AdminReturnsRoot) =>
  state.adminReturns.detailsById[id] ?? null;
