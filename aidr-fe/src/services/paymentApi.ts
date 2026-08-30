import type {
  CreatePayOsPaymentApiResult,
  CreatePayOsPaymentRequest,
  PayOsWebhookApiResult,
  PayOsWebhookRequest,
  SyncPayOsPaymentApiResult,
  SyncPayOsPaymentRequest,
} from '../types/payment';
import { apiClient } from './apiClient';

export async function createPayOsPayment(request: CreatePayOsPaymentRequest) {
  const { data } = await apiClient.post<CreatePayOsPaymentApiResult>(
    '/payments/payos/create',
    request,
  );
  return data;
}

/** Used only when BE PayOS:UseMock redirects back with mockPayOs=1. */
export async function postPayOsWebhook(request: PayOsWebhookRequest) {
  const { data } = await apiClient.post<PayOsWebhookApiResult>(
    '/payments/payos/webhook',
    request,
  );
  return data;
}

/**
 * Ask the API to reconcile one order against payOS. Needed because the payOS
 * webhook cannot reach a machine that is not publicly addressable, so a buyer
 * returning from the checkout page would otherwise still see "pending".
 */
export async function syncPayOsPayment(request: SyncPayOsPaymentRequest) {
  const { data } = await apiClient.post<SyncPayOsPaymentApiResult>('/payments/payos/sync', request);
  return data;
}
