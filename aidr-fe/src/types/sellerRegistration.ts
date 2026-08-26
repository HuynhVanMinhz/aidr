import type { ApiResult } from './auth';

export type BuyerSellerRegistration = {
  requestId: string;
  shopName: string;
  businessInfo?: string | null;
  documentUrls: string[];
  status: string;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type CreateSellerRegistrationPayload = {
  shopName: string;
  businessInfo?: string | null;
  documentUrls?: string[] | null;
};

export type BuyerSellerRegistrationApiResult = ApiResult<BuyerSellerRegistration>;
