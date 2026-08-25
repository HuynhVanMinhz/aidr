import type {
  CreatePayOsPaymentApiResult,
  CreatePayOsPaymentRequest,
  PayOsWebhookApiResult,
  PayOsWebhookRequest,
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
