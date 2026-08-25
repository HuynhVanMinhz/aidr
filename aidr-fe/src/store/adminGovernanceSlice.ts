import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as adminApi from '../services/adminApi';
import type {
  AdminAccount,
  AdminAccountListQuery,
  AdminCustomerInsights,
  AdminCustomerInsightsQuery,
} from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export type AdminAccountSummary = {
  activeCount: number;
  lockedCount: number;
  pendingDeletionCount: number;
  buyerCount: number;
  sellerCount: number;
  adminCount: number;
};

export type AdminGovernanceState = {
  accounts: AdminAccount[];
  page: number;
  pageSize: number;
  totalCount: number;
  summary: AdminAccountSummary;
  selected: AdminAccount | null;
  insights: AdminCustomerInsights | null;
  loadingList: boolean;
  loadingDetail: boolean;
  loadingInsights: boolean;
  mutating: boolean;
  listError: string | null;
  detailError: string | null;
  insightsError: string | null;
};

type AdminGovernanceRoot = { adminGovernance: AdminGovernanceState };

const emptySummary: AdminAccountSummary = {
  activeCount: 0,
  lockedCount: 0,
  pendingDeletionCount: 0,
  buyerCount: 0,
  sellerCount: 0,
  adminCount: 0,
};

const initialState: AdminGovernanceState = {
  accounts: [],
  page: 1,
  pageSize: 10,
  totalCount: 0,
  summary: emptySummary,
  selected: null,
  insights: null,
  loadingList: false,
  loadingDetail: false,
  loadingInsights: false,
  mutating: false,
  listError: null,
  detailError: null,
  insightsError: null,
};

function unwrap<T>(result: { success: boolean; data?: T; message?: string | null }, fallback: string): T {
  if (!result.success || result.data === undefined || result.data === null) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

function upsertAccount(state: AdminGovernanceState, account: AdminAccount) {
  const index = state.accounts.findIndex((a) => a.userId === account.userId);
  if (index >= 0) state.accounts[index] = account;
  if (state.selected?.userId === account.userId) state.selected = account;
}

export const fetchAdminAccounts = createAsyncThunk(
  'adminGovernance/listAccounts',
  async (query: AdminAccountListQuery | undefined, { rejectWithValue }) => {
    try {
      const result = await adminApi.listAdminAccounts(query ?? {});
      return unwrap(result, 'Unable to load accounts.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load accounts.'));
    }
  },
);

export const fetchAdminAccount = createAsyncThunk(
  'adminGovernance/getAccount',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await adminApi.getAdminAccount(id);
      return unwrap(result, 'Unable to load account.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load account.'));
    }
  },
);

export const lockAdminAccount = createAsyncThunk(
  'adminGovernance/lockAccount',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await adminApi.lockAdminAccount(id);
      return unwrap(result, 'Unable to lock account.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to lock account.'));
    }
  },
);

export const unlockAdminAccount = createAsyncThunk(
  'adminGovernance/unlockAccount',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await adminApi.unlockAdminAccount(id);
      return unwrap(result, 'Unable to unlock account.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to unlock account.'));
    }
  },
);

export const fetchAdminCustomerInsights = createAsyncThunk(
  'adminGovernance/customerInsights',
  async (query: AdminCustomerInsightsQuery | undefined, { rejectWithValue }) => {
    try {
      const result = await adminApi.getAdminCustomerInsights(query ?? {});
      return unwrap(result, 'Unable to load customer insights.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load customer insights.'));
    }
  },
);

export const adminGovernanceSlice = createSlice({
  name: 'adminGovernance',
  initialState,
  reducers: {
    clearAdminAccountDetail(state) {
      state.selected = null;
      state.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => initialState)
      .addCase(fetchAdminAccounts.pending, (state) => {
        state.loadingList = true;
        state.listError = null;
      })
      .addCase(fetchAdminAccounts.fulfilled, (state, action) => {
        state.loadingList = false;
        state.accounts = action.payload.items;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.totalCount = action.payload.totalCount;
        state.summary = {
          activeCount: action.payload.activeCount,
          lockedCount: action.payload.lockedCount,
          pendingDeletionCount: action.payload.pendingDeletionCount,
          buyerCount: action.payload.buyerCount,
          sellerCount: action.payload.sellerCount,
          adminCount: action.payload.adminCount,
        };
      })
      .addCase(fetchAdminAccounts.rejected, (state, action) => {
        state.loadingList = false;
        state.listError =
          typeof action.payload === 'string' ? action.payload : 'Unable to load accounts.';
      })
      .addCase(fetchAdminAccount.pending, (state) => {
        state.loadingDetail = true;
        state.detailError = null;
      })
      .addCase(fetchAdminAccount.fulfilled, (state, action) => {
        state.loadingDetail = false;
        state.selected = action.payload;
        upsertAccount(state, action.payload);
      })
      .addCase(fetchAdminAccount.rejected, (state, action) => {
        state.loadingDetail = false;
        state.selected = null;
        state.detailError =
          typeof action.payload === 'string' ? action.payload : 'Unable to load account.';
      })
      .addCase(lockAdminAccount.pending, (state) => {
        state.mutating = true;
      })
      .addCase(lockAdminAccount.fulfilled, (state, action) => {
        state.mutating = false;
        upsertAccount(state, action.payload);
      })
      .addCase(lockAdminAccount.rejected, (state) => {
        state.mutating = false;
      })
      .addCase(unlockAdminAccount.pending, (state) => {
        state.mutating = true;
      })
      .addCase(unlockAdminAccount.fulfilled, (state, action) => {
        state.mutating = false;
        upsertAccount(state, action.payload);
      })
      .addCase(unlockAdminAccount.rejected, (state) => {
        state.mutating = false;
      })
      .addCase(fetchAdminCustomerInsights.pending, (state) => {
        state.loadingInsights = true;
        state.insightsError = null;
      })
      .addCase(fetchAdminCustomerInsights.fulfilled, (state, action) => {
        state.loadingInsights = false;
        state.insights = action.payload;
      })
      .addCase(fetchAdminCustomerInsights.rejected, (state, action) => {
        state.loadingInsights = false;
        state.insightsError =
          typeof action.payload === 'string'
            ? action.payload
            : 'Unable to load customer insights.';
      });
  },
});

export const { clearAdminAccountDetail } = adminGovernanceSlice.actions;

export const selectAdminAccounts = (state: AdminGovernanceRoot) => state.adminGovernance.accounts;
export const selectAdminAccountPage = (state: AdminGovernanceRoot) => state.adminGovernance.page;
export const selectAdminAccountPageSize = (state: AdminGovernanceRoot) =>
  state.adminGovernance.pageSize;
export const selectAdminAccountTotalCount = (state: AdminGovernanceRoot) =>
  state.adminGovernance.totalCount;
export const selectAdminAccountSummary = (state: AdminGovernanceRoot) =>
  state.adminGovernance.summary;
export const selectAdminAccountSelected = (state: AdminGovernanceRoot) =>
  state.adminGovernance.selected;
export const selectAdminAccountsLoading = (state: AdminGovernanceRoot) =>
  state.adminGovernance.loadingList;
export const selectAdminAccountDetailLoading = (state: AdminGovernanceRoot) =>
  state.adminGovernance.loadingDetail;
export const selectAdminAccountsMutating = (state: AdminGovernanceRoot) =>
  state.adminGovernance.mutating;
export const selectAdminAccountsError = (state: AdminGovernanceRoot) =>
  state.adminGovernance.listError;
export const selectAdminAccountDetailError = (state: AdminGovernanceRoot) =>
  state.adminGovernance.detailError;
export const selectAdminCustomerInsights = (state: AdminGovernanceRoot) =>
  state.adminGovernance.insights;
export const selectAdminCustomerInsightsLoading = (state: AdminGovernanceRoot) =>
  state.adminGovernance.loadingInsights;
export const selectAdminCustomerInsightsError = (state: AdminGovernanceRoot) =>
  state.adminGovernance.insightsError;
