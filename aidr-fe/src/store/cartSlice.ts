import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as cartApi from '../services/cartApi';
import type { Cart, CartItem } from '../types/cart';
import { getApiErrorMessage } from '../utils/apiError';

export type CartState = {
  cartId: string | null;
  items: CartItem[];
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  currency: string;
  updatedAt: string | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
  /** Cart items ticked for checkout. Unavailable items are never selectable. */
  selectedIds: string[];
};

type CartRoot = { cart: CartState };

const emptyCartState = (): Omit<CartState, 'loading' | 'mutating' | 'error' | 'loaded'> => ({
  cartId: null,
  items: [],
  itemCount: 0,
  totalQuantity: 0,
  subtotal: 0,
  currency: 'VND',
  updatedAt: null,
  selectedIds: [],
});

const initialState: CartState = {
  ...emptyCartState(),
  loading: false,
  mutating: false,
  error: null,
  loaded: false,
};

function applyCart(state: CartState, cart: Cart) {
  // Items already in the cart keep whatever the shopper ticked; anything new
  // (or the very first load) starts selected.
  const knownIds = new Set(state.items.map((i) => i.cartItemId));
  const selected = new Set(state.selectedIds);
  const hadCart = state.loaded;

  state.cartId = cart.cartId;
  state.items = cart.items ?? [];
  state.itemCount = cart.itemCount;
  state.totalQuantity = cart.totalQuantity;
  state.subtotal = cart.subtotal;
  state.currency = cart.currency || 'VND';
  state.updatedAt = cart.updatedAt;
  state.loaded = true;
  state.error = null;

  state.selectedIds = state.items
    .filter((item) => item.isAvailable)
    .filter((item) => (hadCart && knownIds.has(item.cartItemId) ? selected.has(item.cartItemId) : true))
    .map((item) => item.cartItemId);
}

function requireCartData(result: { success: boolean; data?: Cart | null; message?: string | null }): Cart {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to update cart.');
  }
  return result.data;
}

export const fetchCart = createAsyncThunk<Cart, void, { rejectValue: string }>(
  'cart/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const result = await cartApi.getCart();
      return requireCartData(result);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load cart.'));
    }
  },
);

export const addCartItem = createAsyncThunk<
  Cart,
  { productId: string; quantity: number },
  { rejectValue: string }
>('cart/addItem', async ({ productId, quantity }, { rejectWithValue }) => {
  try {
    const result = await cartApi.addCartItem({ productId, quantity });
    return requireCartData(result);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to add item to cart.'));
  }
});

export const updateCartItemQty = createAsyncThunk<
  Cart,
  { cartItemId: string; quantity: number },
  { rejectValue: string }
>('cart/updateItem', async ({ cartItemId, quantity }, { rejectWithValue }) => {
  try {
    const result = await cartApi.updateCartItem(cartItemId, { quantity });
    return requireCartData(result);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to update cart item.'));
  }
});

export const removeCartItem = createAsyncThunk<Cart, string, { rejectValue: string }>(
  'cart/removeItem',
  async (cartItemId, { rejectWithValue }) => {
    try {
      const result = await cartApi.removeCartItem(cartItemId);
      return requireCartData(result);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to remove cart item.'));
    }
  },
);

export const clearCartItems = createAsyncThunk<Cart | null, void, { state: CartRoot; rejectValue: string }>(
  'cart/clearItems',
  async (_, { getState, rejectWithValue }) => {
    try {
      const items = [...getState().cart.items];
      let last: Cart | null = null;
      for (const item of items) {
        const result = await cartApi.removeCartItem(item.cartItemId);
        last = requireCartData(result);
      }
      return last;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to clear cart.'));
    }
  },
);

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearCartState() {
      return { ...initialState };
    },
    toggleCartSelection(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (state.selectedIds.includes(id)) {
        state.selectedIds = state.selectedIds.filter((x) => x !== id);
        return;
      }
      const item = state.items.find((i) => i.cartItemId === id);
      if (item?.isAvailable) state.selectedIds.push(id);
    },
    selectAllCartItems(state) {
      state.selectedIds = state.items.filter((i) => i.isAvailable).map((i) => i.cartItemId);
    },
    clearCartSelection(state) {
      state.selectedIds = [];
    },
    /** Buy now: check out exactly one line without touching the rest of the cart. */
    selectOnlyCartItem(state, action: PayloadAction<string>) {
      const item = state.items.find((i) => i.cartItemId === action.payload);
      state.selectedIds = item?.isAvailable ? [item.cartItemId] : [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;
        applyCart(state, action.payload);
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to load cart.';
      })
      .addCase(addCartItem.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(addCartItem.fulfilled, (state, action) => {
        state.mutating = false;
        applyCart(state, action.payload);
      })
      .addCase(addCartItem.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to add item to cart.';
      })
      .addCase(updateCartItemQty.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateCartItemQty.fulfilled, (state, action) => {
        state.mutating = false;
        applyCart(state, action.payload);
      })
      .addCase(updateCartItemQty.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to update cart item.';
      })
      .addCase(removeCartItem.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(removeCartItem.fulfilled, (state, action) => {
        state.mutating = false;
        applyCart(state, action.payload);
      })
      .addCase(removeCartItem.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to remove cart item.';
      })
      .addCase(clearCartItems.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(clearCartItems.fulfilled, (state, action) => {
        state.mutating = false;
        if (action.payload) {
          applyCart(state, action.payload);
        } else {
          Object.assign(state, emptyCartState());
          state.loaded = true;
        }
      })
      .addCase(clearCartItems.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to clear cart.';
      });
  },
});

export const {
  clearCartState,
  toggleCartSelection,
  selectAllCartItems,
  clearCartSelection,
  selectOnlyCartItem,
} = cartSlice.actions;

export const selectCart = (state: CartRoot) => state.cart;
export const selectCartItems = (state: CartRoot) => state.cart.items;
export const selectCartTotalQuantity = (state: CartRoot) => state.cart.totalQuantity;
export const selectCartSubtotal = (state: CartRoot) => state.cart.subtotal;
export const selectCartLoading = (state: CartRoot) => state.cart.loading;
export const selectCartMutating = (state: CartRoot) => state.cart.mutating;
export const selectCartError = (state: CartRoot) => state.cart.error;
export const selectCartLoaded = (state: CartRoot) => state.cart.loaded;
export const selectCartSelectedIds = (state: CartRoot) => state.cart.selectedIds;
