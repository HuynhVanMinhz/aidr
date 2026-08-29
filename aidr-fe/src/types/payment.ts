import type { ApiResult } from './auth';

export type CreatePayOsPaymentRequest = {
  orderId: string;
};

export type CreatePayOsPaymentResponse = {
  paymentId: string;
  orderId: string;
  orderCode: string;
  checkoutUrl: string;
  providerPaymentId?: string | null;
  payOsOrderCode: number;
  paymentStatus: string;
  orderStatus: string;
  amount: number;
  currency: string;
};

export type CreatePayOsPaymentApiResult = ApiResult<CreatePayOsPaymentResponse>;

export type OrderPaymentLink = {
  orderId: string;
  orderCode: string;
  paymentId: string;
  checkoutUrl: string;
  providerPaymentId: string;
  payOsOrderCode: number;
  paymentStatus: string;
  orderStatus: string;
  amount: number;
  currency: string;
};

export type SyncPayOsPaymentRequest = {
  orderId: string;
};

export type SyncPayOsPaymentResponse = {
  orderId: string;
  orderCode: string;
  paymentStatus: string;
  orderStatus: string;
  /** Raw payOS payment-link state: PENDING | PAID | CANCELLED | EXPIRED | ... */
  providerStatus: string;
  /** True when this call is what moved the order to Paid. */
  reconciled: boolean;
  message: string;
};

export type SyncPayOsPaymentApiResult = ApiResult<SyncPayOsPaymentResponse>;

export type PayOsWebhookRequest = {
  code?: string;
  description?: string;
  success: boolean;
  signature?: string;
  data: {
    orderCode: number;
    amount: number;
    description?: string;
    accountNumber?: string;
    reference?: string;
    transactionDateTime?: string;
    currency?: string;
    paymentLinkId: string;
    code?: string;
  };
};

export type PayOsWebhookResult = {
  processed: boolean;
  idempotentReplay: boolean;
  message: string;
  paymentId?: string | null;
  orderId?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
};

export type PayOsWebhookApiResult = ApiResult<PayOsWebhookResult>;
