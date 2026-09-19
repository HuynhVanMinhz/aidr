import type { ApiResult } from './auth';
import type { OrderRoute } from './tracking';

export type SellerOrderStatus =
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

export type ShipmentStatus =
  | 'Pending'
  | 'Created'
  | 'PickedUp'
  | 'InTransit'
  | 'Delivered'
  | 'Failed'
  | 'Returned'
  | 'Cancelled'
  | string;

export type ShipmentEvent = {
  shipmentEventId: string;
  providerStatus: string;
  mappedStatus: ShipmentStatus;
  description?: string | null;
  source: string;
  occurredAt: string;
};

export type Shipment = {
  shipmentId: string;
  orderId: string;
  provider: string;
  providerShipmentId?: string | null;
  trackingCode?: string | null;
  status: ShipmentStatus;
  providerStatus?: string | null;
  shippingFeeQuoted?: number | null;
  expectedDeliveryAt?: string | null;
  lastSyncedAt?: string | null;
  attemptCount: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  events: ShipmentEvent[];
};

/** Who is moving this order forward - the carrier, or the seller. */
export type OrderFulfillment = {
  autoEnabled: boolean;
  provider: string;
  requiresSellerAction: boolean;
  stalledReason?: string | null;
  shipment?: Shipment | null;
  /** Pickup and delivery points, for the tracking map. */
  route: OrderRoute;
};

export type SellerOrderListQuery = {
  status?: string | null;
  page?: number;
  pageSize?: number;
};

export type SellerOrderListItem = {
  orderId: string;
  orderCode: string;
  buyerUserId: string;
  buyerName: string;
  buyerPhone?: string | null;
  status: SellerOrderStatus;
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
  canUpdateStatus: boolean;
  nextStatus?: string | null;
  autoFulfillment: boolean;
  shipmentStatus?: string | null;
};

export type SellerOrderListResult = {
  items: SellerOrderListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type SellerOrderShipping = {
  addressId?: string | null;
  receiverName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type SellerOrderItem = {
  orderItemId: string;
  productId: string;
  variantId?: string | null;
  /** The configuration as it read at checkout; null for a single-configuration product. */
  variantName?: string | null;
  productName: string;
  sku?: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type SellerOrderPayment = {
  paymentId: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  paidAt?: string | null;
  createdAt: string;
};

export type SellerOrderStatusHistory = {
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  createdAt: string;
};

export type SellerOrderDetail = {
  orderId: string;
  orderCode: string;
  shopId: string;
  buyerUserId: string;
  buyerName: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  status: SellerOrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  buyerNote?: string | null;
  sellerNote?: string | null;
  trackingCode?: string | null;
  shipping: SellerOrderShipping;
  items: SellerOrderItem[];
  payment?: SellerOrderPayment | null;
  statusHistory: SellerOrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  canUpdateStatus: boolean;
  nextStatus?: string | null;
  fulfillment: OrderFulfillment;
};

export type UpdateSellerOrderRequest = {
  status: string;
  trackingCode?: string | null;
  sellerNote?: string | null;
  note?: string | null;
};

export type SellerOrderListApiResult = ApiResult<SellerOrderListResult>;
export type SellerOrderDetailApiResult = ApiResult<SellerOrderDetail>;
