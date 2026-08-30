import type { ApiResult } from './auth';

export type AdminDashboard = {
  pendingProducts: number;
  approvedProducts: number;
  pendingSellerRegistrations: number;
  pendingReturns: number;
  activeUsers: number;
  lockedUsers: number;
  activeShops: number;
  systemVoucherActiveCount: number;
};

export type AdminDashboardApiResult = ApiResult<AdminDashboard>;

export type AdminOrderListItem = {
  orderId: string;
  orderCode: string;
  buyerUserId: string;
  buyerEmail: string;
  buyerName: string;
  shopId: string;
  shopName: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
};

export type AdminOrderListResult = {
  items: AdminOrderListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminOrderListQuery = {
  status?: string | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
};

export type AdminOrderItem = {
  orderItemId: string;
  productId: string;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type AdminOrderStatusHistory = {
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  createdAt: string;
};

export type AdminOrderDetail = {
  orderId: string;
  orderCode: string;
  buyerUserId: string;
  buyerEmail: string;
  buyerName: string;
  buyerPhone?: string | null;
  shopId: string;
  shopName: string;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  buyerNote?: string | null;
  sellerNote?: string | null;
  trackingCode?: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  items: AdminOrderItem[];
  statusHistory: AdminOrderStatusHistory[];
};

export type AdminOrderListApiResult = ApiResult<AdminOrderListResult>;
export type AdminOrderDetailApiResult = ApiResult<AdminOrderDetail>;
