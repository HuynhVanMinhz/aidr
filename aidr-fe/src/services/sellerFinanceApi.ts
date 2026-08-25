import type { ApiResult } from '../types/auth';
import type {
  SellerDashboard,
  SellerSalesReport,
  SellerSalesReportQuery,
  SellerWallet,
  SellerWalletQuery,
} from '../types/sellerFinance';
import { apiClient } from './apiClient';

function toReportParams(query: SellerSalesReportQuery = {}): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.granularity) params.granularity = query.granularity;
  return params;
}

function toWalletParams(query: SellerWalletQuery = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.txType?.trim()) params.txType = query.txType.trim();
  if (query.page != null) params.page = query.page;
  if (query.pageSize != null) params.pageSize = query.pageSize;
  return params;
}

export async function getSellerDashboard() {
  const { data } = await apiClient.get<ApiResult<SellerDashboard>>('/seller/dashboard');
  return data;
}

export async function getSellerSalesReport(query: SellerSalesReportQuery = {}) {
  const { data } = await apiClient.get<ApiResult<SellerSalesReport>>('/seller/reports', {
    params: toReportParams(query),
  });
  return data;
}

export async function getSellerWallet(query: SellerWalletQuery = {}) {
  const { data } = await apiClient.get<ApiResult<SellerWallet>>('/seller/wallet', {
    params: toWalletParams(query),
  });
  return data;
}
