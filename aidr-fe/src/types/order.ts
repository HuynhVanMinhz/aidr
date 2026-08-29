import type { ApiResult } from './auth';
import type { OrderPaymentLink } from './payment';

export type CreateOrderRequest = {
  shippingAddressId: string;
  cartItemIds?: string[] | null;
  buyerNote?: string | null;
  vouchers?: Array<{ shopId: string; voucherId: string }> | null;
};

export type CreatedOrderItem = {
  orderItemId: string;
  productId: string;
  productName: string;
  sku?: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  unitCostAvg?: number | null;
  lineTotal: number;
};

export type CreatedOrder = {
  orderId: string;
  orderCode: string;
  shopId: string;
  shopName: string;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  paymentId: string;
  paymentStatus: string;
  items: CreatedOrderItem[];
  createdAt: string;
};

export type CreateOrderResponse = {
  orders: CreatedOrder[];
  orderCount: number;
  grandTotal: number;
  currency: string;
};

export type CreateOrderApiResult = ApiResult<CreateOrderResponse>;

/** Snapshot kept for the order-received page (shipping display + payOS links). */
export type CheckoutSuccessState = {
  orders: CreatedOrder[];
  grandTotal: number;
  currency: string;
  buyerNote?: string | null;
  shipping: {
    receiverName: string;
    phone: string;
    province: string;
    district: string;
    ward: string;
    streetAddress: string;
  };
  payments?: OrderPaymentLink[];
};

export type BuyerOrderStatus =
  | 'PendingPayment'
  | 'Paid'
  | 'Confirmed'
  | 'Shipping'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled'
  | 'ReturnRequested'
  | 'Returned'
  | string;

export type BuyerOrderListQuery = {
  status?: string | null;
  page?: number;
  pageSize?: number;
};

export type BuyerOrderListItem = {
  orderId: string;
  orderCode: string;
  shopId: string;
  shopName: string;
  status: BuyerOrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  itemCount: number;
  thumbnailUrl?: string | null;
  trackingCode?: string | null;
  createdAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
};

export type BuyerOrderListResult = {
  items: BuyerOrderListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type BuyerOrderShipping = {
  addressId?: string | null;
  receiverName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
};

export type BuyerOrderItem = {
  orderItemId: string;
  productId: string;
  productName: string;
  sku?: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type BuyerOrderPayment = {
  paymentId: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  checkoutUrl?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

export type BuyerOrderStatusHistory = {
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  createdAt: string;
};

export type BuyerOrderDetail = {
  orderId: string;
  orderCode: string;
  shopId: string;
  shopName: string;
  status: BuyerOrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  buyerNote?: string | null;
  sellerNote?: string | null;
  trackingCode?: string | null;
  shipping: BuyerOrderShipping;
  items: BuyerOrderItem[];
  payment?: BuyerOrderPayment | null;
  statusHistory: BuyerOrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  canCancel: boolean;
  canConfirmReceived: boolean;
};

export type CancelOrderRequest = {
  reason?: string | null;
};

export type BuyerOrderListApiResult = ApiResult<BuyerOrderListResult>;
export type BuyerOrderDetailApiResult = ApiResult<BuyerOrderDetail>;
