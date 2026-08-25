import type { ApiResult } from './auth';

export type CreateOrderRequest = {
  shippingAddressId: string;
  cartItemIds?: string[] | null;
  buyerNote?: string | null;
};

export type CreatedOrderItem = {
  orderItemId: string;
  productId: string;
  productName: string;
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

/** Snapshot kept for the order-received page (shipping display). */
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
};
