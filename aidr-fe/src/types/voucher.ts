import type { ApiResult } from './auth';

export type VoucherListItem = {
  voucherId: string;
  code: string;
  name: string;
  description?: string | null;
  scope: string;
  shopId?: string | null;
  shopName?: string | null;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  startsAt: string;
  endsAt: string;
  applicableSubtotal: number;
  estimatedDiscountAmount: number;
  isEligible: boolean;
  ineligibilityReason?: string | null;
};

export type VoucherListResult = {
  items: VoucherListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  cartSubtotal: number;
  currency: string;
};

export type ApplyVoucherPreviewRequest = {
  voucherId?: string | null;
  code?: string | null;
  shopId?: string | null;
  cartItemIds?: string[] | null;
};

export type ApplyVoucherPreview = {
  voucherId: string;
  code: string;
  name: string;
  scope: string;
  shopId?: string | null;
  applicableShopId: string;
  shopName?: string | null;
  discountType: string;
  discountValue: number;
  subtotalAmount: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  isValid: boolean;
  message?: string | null;
};

/** Client-side applied voucher ready for checkout create-order payload. */
export type AppliedVoucher = {
  shopId: string;
  shopName?: string | null;
  voucherId: string;
  code: string;
  name: string;
  scope: string;
  discountAmount: number;
  subtotalAmount: number;
  totalAmount: number;
  currency: string;
};

export type OrderVoucherSelection = {
  shopId: string;
  voucherId: string;
};

export type VoucherListQuery = {
  cartItemIds?: string[] | null;
  scope?: string | null;
  shopId?: string | null;
  page?: number;
  pageSize?: number;
};

export type VoucherListApiResult = ApiResult<VoucherListResult>;
export type VoucherPreviewApiResult = ApiResult<ApplyVoucherPreview>;
