import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as sellerFinanceApi from '../services/sellerFinanceApi';
import type {
  SellerDashboard,
  SellerSalesReport,
  SellerSalesReportQuery,
  SellerWallet,
  SellerWalletQuery,
} from '../types/sellerFinance';
import { getApiErrorMessage } from '../utils/apiError';

type SellerFinanceState = {
  dashboard: SellerDashboard | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  report: SellerSalesReport | null;
  reportQuery: SellerSalesReportQuery | null;
  reportLoading: boolean;
  reportError: string | null;
  wallet: SellerWallet | null;
  walletQuery: SellerWalletQuery | null;
  walletLoading: boolean;
  walletError: string | null;
};

type SellerFinanceRoot = { sellerFinance: SellerFinanceState };

const initialState: SellerFinanceState = {
  dashboard: null,
  dashboardLoading: false,
  dashboardError: null,
  report: null,
  reportQuery: null,
  reportLoading: false,
  reportError: null,
  wallet: null,
  walletQuery: null,
  walletLoading: false,
  walletError: null,
};

function unwrap<T>(result: { success: boolean; data?: T; message?: string }, fallback: string): T {
  if (!result.success || result.data === undefined) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

export const fetchSellerDashboard = createAsyncThunk(
  'sellerFinance/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const result = await sellerFinanceApi.getSellerDashboard();
      return unwrap(result, 'Unable to load dashboard.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load dashboard.'));
    }
  },
);

export const fetchSellerSalesReport = createAsyncThunk(
  'sellerFinance/fetchReport',
  async (query: SellerSalesReportQuery, { rejectWithValue }) => {
    try {
      const result = await sellerFinanceApi.getSellerSalesReport(query);
      return { report: unwrap(result, 'Unable to load sales report.'), query };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load sales report.'));
    }
  },
);

export const fetchSellerWallet = createAsyncThunk(
  'sellerFinance/fetchWallet',
  async (query: SellerWalletQuery, { rejectWithValue }) => {
    try {
      const result = await sellerFinanceApi.getSellerWallet(query);
      return { wallet: unwrap(result, 'Unable to load wallet.'), query };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load wallet.'));
    }
  },
);

function reportQueryKey(query: SellerSalesReportQuery | null): string {
  if (!query) return '';
  return `${query.from ?? ''}|${query.to ?? ''}|${query.granularity ?? ''}`;
}

function walletQueryKey(query: SellerWalletQuery | null): string {
  if (!query) return '';
  return `${query.txType ?? ''}|${query.page ?? 1}|${query.pageSize ?? 20}`;
}

export const sellerFinanceSlice = createSlice({
  name: 'sellerFinance',
  initialState,
  reducers: {
    clearSellerFinanceErrors(state) {
      state.dashboardError = null;
      state.reportError = null;
      state.walletError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSellerDashboard.pending, (state) => {
        state.dashboardLoading = true;
        state.dashboardError = null;
      })
      .addCase(fetchSellerDashboard.fulfilled, (state, action) => {
        state.dashboardLoading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchSellerDashboard.rejected, (state, action) => {
        state.dashboardLoading = false;
        state.dashboardError = (action.payload as string) || 'Unable to load dashboard.';
      })
      .addCase(fetchSellerSalesReport.pending, (state) => {
        state.reportLoading = true;
        state.reportError = null;
      })
      .addCase(fetchSellerSalesReport.fulfilled, (state, action) => {
        state.reportLoading = false;
        state.report = action.payload.report;
        state.reportQuery = action.payload.query;
      })
      .addCase(fetchSellerSalesReport.rejected, (state, action) => {
        state.reportLoading = false;
        state.reportError = (action.payload as string) || 'Unable to load sales report.';
      })
      .addCase(fetchSellerWallet.pending, (state) => {
        state.walletLoading = true;
        state.walletError = null;
      })
      .addCase(fetchSellerWallet.fulfilled, (state, action) => {
        state.walletLoading = false;
        state.wallet = action.payload.wallet;
        state.walletQuery = action.payload.query;
      })
      .addCase(fetchSellerWallet.rejected, (state, action) => {
        state.walletLoading = false;
        state.walletError = (action.payload as string) || 'Unable to load wallet.';
      });
  },
});

export const { clearSellerFinanceErrors } = sellerFinanceSlice.actions;

export const selectSellerDashboard = (state: SellerFinanceRoot) => state.sellerFinance.dashboard;
export const selectSellerDashboardLoading = (state: SellerFinanceRoot) =>
  state.sellerFinance.dashboardLoading;
export const selectSellerDashboardError = (state: SellerFinanceRoot) =>
  state.sellerFinance.dashboardError;

export const selectSellerSalesReport = (state: SellerFinanceRoot) => state.sellerFinance.report;
export const selectSellerSalesReportQuery = (state: SellerFinanceRoot) =>
  state.sellerFinance.reportQuery;
export const selectSellerSalesReportLoading = (state: SellerFinanceRoot) =>
  state.sellerFinance.reportLoading;
export const selectSellerSalesReportError = (state: SellerFinanceRoot) =>
  state.sellerFinance.reportError;

export const selectSellerWallet = (state: SellerFinanceRoot) => state.sellerFinance.wallet;
export const selectSellerWalletQuery = (state: SellerFinanceRoot) => state.sellerFinance.walletQuery;
export const selectSellerWalletLoading = (state: SellerFinanceRoot) =>
  state.sellerFinance.walletLoading;
export const selectSellerWalletError = (state: SellerFinanceRoot) =>
  state.sellerFinance.walletError;

export function selectSellerSalesReportMatchesQuery(
  state: SellerFinanceRoot,
  query: SellerSalesReportQuery,
): boolean {
  return reportQueryKey(state.sellerFinance.reportQuery) === reportQueryKey(query);
}

export function selectSellerWalletMatchesQuery(
  state: SellerFinanceRoot,
  query: SellerWalletQuery,
): boolean {
  return walletQueryKey(state.sellerFinance.walletQuery) === walletQueryKey(query);
}
