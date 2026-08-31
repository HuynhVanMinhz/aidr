import type { ApiResult } from './auth';

export type CartItem = {
  cartItemId: string;
  productId: string;
  variantId?: string | null;
  /** "Orange / 128GB", so the row reads as the thing that was actually chosen. */
  variantName?: string | null;
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
  /** Required when the product has variants. */
  variantId?: string | null;
  quantity: number;
};

export type UpdateCartItemRequest = {
  quantity: number;
};

export type CartApiResult = ApiResult<Cart>;
