import type { ApiResult } from './auth';

export type CartItem = {
  cartItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  primaryImageUrl?: string | null;
  shopId: string;
  shopName: string;
  shopSlug: string;
  quantity: number;
  unitPriceSnapshot: number;
  currentPrice: number;
  lineTotal: number;
  currency: string;
  availableQuantity: number;
  isAvailable: boolean;
  updatedAt: string;
};

export type Cart = {
  cartId: string;
  items: CartItem[];
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  currency: string;
  updatedAt: string;
};

export type AddCartItemRequest = {
  productId: string;
  quantity: number;
};

export type UpdateCartItemRequest = {
  quantity: number;
};

export type CartApiResult = ApiResult<Cart>;
