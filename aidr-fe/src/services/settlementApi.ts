import type { ApiResult } from '../types/auth';
import type {
  AdminShopBankAccount,
  PayoutBatch,
  PayoutBatchList,
  PlatformCommissionReport,
  SettlementEligibleShop,
  SettlementEntryList,
  SettlementQuery,
  SettlementSummary,
  ShopBankAccount,
  UpsertShopBankAccountRequest,
} from '../types/settlement';
import { apiClient } from './apiClient';

function toQueryParams(query: SettlementQuery = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.status?.trim()) params.status = query.status.trim();
  if (query.page != null) params.page = query.page;
  if (query.pageSize != null) params.pageSize = query.pageSize;
  return params;
}

/* ------------------------------------------------------------------ seller */

export async function getSellerBankAccount() {
  const { data } = await apiClient.get<ApiResult<ShopBankAccount | null>>('/seller/bank-account');
  return data;
}

export async function upsertSellerBankAccount(request: UpsertShopBankAccountRequest) {
  const { data } = await apiClient.put<ApiResult<ShopBankAccount>>('/seller/bank-account', request);
  return data;
}

export async function getSellerSettlements(query: SettlementQuery = {}) {
  const { data } = await apiClient.get<ApiResult<SettlementEntryList>>('/seller/settlements', {
    params: toQueryParams(query),
  });
  return data;
}

export async function getSellerSettlementSummary() {
  const { data } = await apiClient.get<ApiResult<SettlementSummary>>('/seller/settlements/summary');
  return data;
}

export async function getSellerPayouts(query: SettlementQuery = {}) {
  const { data } = await apiClient.get<ApiResult<PayoutBatchList>>('/seller/payouts', {
    params: toQueryParams(query),
  });
  return data;
}

/* ------------------------------------------------------------------- admin */

export async function getEligibleShops() {
  const { data } = await apiClient.get<ApiResult<SettlementEligibleShop[]>>(
    '/admin/settlements/eligible',
  );
  return data;
}

export async function getAdminBankAccounts(status?: string) {
  const { data } = await apiClient.get<ApiResult<AdminShopBankAccount[]>>(
    '/admin/settlements/bank-accounts',
    { params: status ? { status } : undefined },
  );
  return data;
}

export async function getAdminPayoutBatches(query: SettlementQuery & { shopId?: string } = {}) {
  const params = toQueryParams(query);
  if (query.shopId) params.shopId = query.shopId;
  const { data } = await apiClient.get<ApiResult<PayoutBatchList>>('/admin/settlements/batches', {
    params,
  });
  return data;
}

export async function createPayoutBatch(shopId: string) {
  const { data } = await apiClient.post<ApiResult<PayoutBatch>>('/admin/settlements/batches', {
    shopId,
  });
  return data;
}

export async function approvePayoutBatch(payoutBatchId: string) {
  const { data } = await apiClient.post<ApiResult<PayoutBatch>>(
    `/admin/settlements/batches/${payoutBatchId}/approve`,
    {},
  );
  return data;
}

export async function executePayoutBatch(payoutBatchId: string) {
  const { data } = await apiClient.post<ApiResult<PayoutBatch>>(
    `/admin/settlements/batches/${payoutBatchId}/execute`,
    {},
  );
  return data;
}

export async function markPayoutBatchPaid(payoutBatchId: string, reference?: string) {
  const { data } = await apiClient.post<ApiResult<PayoutBatch>>(
    `/admin/settlements/batches/${payoutBatchId}/mark-paid`,
    { reference: reference ?? null },
  );
  return data;
}

export async function cancelPayoutBatch(payoutBatchId: string) {
  const { data } = await apiClient.post<ApiResult<PayoutBatch>>(
    `/admin/settlements/batches/${payoutBatchId}/cancel`,
    {},
  );
  return data;
}

export async function verifyShopBankAccount(
  shopId: string,
  approve: boolean,
  reason?: string,
) {
  const { data } = await apiClient.post<ApiResult<ShopBankAccount>>(
    `/admin/settlements/shops/${shopId}/bank-account/verify`,
    { approve, reason: reason ?? null },
  );
  return data;
}

export async function getPlatformCommissionReport(from?: string, to?: string) {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await apiClient.get<ApiResult<PlatformCommissionReport>>(
    '/admin/finance/commission',
    { params },
  );
  return data;
}

export async function runSettlementSweep() {
  const { data } = await apiClient.post<ApiResult<unknown>>('/admin/settlements/sweep', {});
  return data;
}
