import type {
  AdminAccount,
  AdminAccountListQuery,
  AdminAccountListResult,
  AdminCustomerInsights,
  AdminCustomerInsightsQuery,
  AdminProductDetail,
  AdminProductListQuery,
  AdminProductListResult,
  AdminSellerRegistration,
  AdminSellerRegistrationListResult,
  ApproveSellerRegistrationResult,
  ProductModerationHistoryResult,
  RejectProductPayload,
  RejectSellerRegistrationPayload,
  SellerRegistrationListQuery,
} from '../types/admin';
import type {
  AdminDashboardApiResult,
  AdminOrderDetailApiResult,
  AdminOrderListApiResult,
  AdminOrderListQuery,
} from '../types/adminOps';
import type { ApiResult } from '../types/catalog';
import { apiClient } from './apiClient';

export async function listSellerRegistrations(query: SellerRegistrationListQuery = {}) {
  const { data } = await apiClient.get<ApiResult<AdminSellerRegistrationListResult>>(
    '/admin/seller-registrations',
    {
      params: {
        status: query.status ?? 'Pending',
        q: query.q || undefined,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
      },
    },
  );
  return data;
}

export async function getSellerRegistration(id: string) {
  const { data } = await apiClient.get<ApiResult<AdminSellerRegistration>>(
    `/admin/seller-registrations/${id}`,
  );
  return data;
}

export async function approveSellerRegistration(id: string) {
  const { data } = await apiClient.post<ApiResult<ApproveSellerRegistrationResult>>(
    `/admin/seller-registrations/${id}/approve`,
  );
  return data;
}

export async function rejectSellerRegistration(id: string, payload: RejectSellerRegistrationPayload) {
  const { data } = await apiClient.post<ApiResult<AdminSellerRegistration>>(
    `/admin/seller-registrations/${id}/reject`,
    payload,
  );
  return data;
}

export async function listAdminProducts(query: AdminProductListQuery = {}) {
  const { data } = await apiClient.get<ApiResult<AdminProductListResult>>('/admin/products', {
    params: {
      status: query.status ?? 'Pending',
      q: query.q || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
  });
  return data;
}

export async function getAdminProduct(id: string) {
  const { data } = await apiClient.get<ApiResult<AdminProductDetail>>(`/admin/products/${id}`);
  return data;
}

export async function approveAdminProduct(id: string) {
  const { data } = await apiClient.post<ApiResult<AdminProductDetail>>(
    `/admin/products/${id}/approve`,
  );
  return data;
}

export async function rejectAdminProduct(id: string, payload: RejectProductPayload) {
  const { data } = await apiClient.post<ApiResult<AdminProductDetail>>(
    `/admin/products/${id}/reject`,
    payload,
  );
  return data;
}

export async function getProductModerationHistory(id: string) {
  const { data } = await apiClient.get<ApiResult<ProductModerationHistoryResult>>(
    `/admin/products/${id}/moderation-history`,
  );
  return data;
}

export async function listAdminAccounts(query: AdminAccountListQuery = {}) {
  const { data } = await apiClient.get<ApiResult<AdminAccountListResult>>('/admin/accounts', {
    params: {
      status: query.status ?? 'all',
      role: query.role ?? 'all',
      q: query.q || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
  });
  return data;
}

export async function getAdminAccount(id: string) {
  const { data } = await apiClient.get<ApiResult<AdminAccount>>(`/admin/accounts/${id}`);
  return data;
}

export async function lockAdminAccount(id: string) {
  const { data } = await apiClient.post<ApiResult<AdminAccount>>(`/admin/accounts/${id}/lock`);
  return data;
}

export async function unlockAdminAccount(id: string) {
  const { data } = await apiClient.post<ApiResult<AdminAccount>>(`/admin/accounts/${id}/unlock`);
  return data;
}

export async function getAdminCustomerInsights(query: AdminCustomerInsightsQuery = {}) {
  const { data } = await apiClient.get<ApiResult<AdminCustomerInsights>>(
    '/admin/insights/customers',
    {
      params: {
        from: query.from || undefined,
        to: query.to || undefined,
        granularity: query.granularity || undefined,
      },
    },
  );
  return data;
}

export async function getAdminDashboard() {
  const { data } = await apiClient.get<AdminDashboardApiResult>('/admin/dashboard');
  return data;
}

export async function listAdminOrders(query: AdminOrderListQuery = {}) {
  const { data } = await apiClient.get<AdminOrderListApiResult>('/admin/orders', {
    params: {
      status: query.status || undefined,
      q: query.q || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
  });
  return data;
}

export async function getAdminOrder(orderId: string) {
  const { data } = await apiClient.get<AdminOrderDetailApiResult>(`/admin/orders/${orderId}`);
  return data;
}
