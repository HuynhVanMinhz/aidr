import { useCallback, useEffect } from 'react';
import { selectIsAuthenticated } from '../store/authSlice';
import {
  addCartItem,
  clearCartItems,
  fetchCart,
  removeCartItem,
  selectCart,
  selectCartLoaded,
  updateCartItemQty,
} from '../store/cartSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getApiErrorMessage } from '../utils/apiError';

export function useCart(options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const cart = useAppSelector(selectCart);
  const loaded = useAppSelector(selectCartLoaded);
  const autoLoad = options?.autoLoad ?? false;

  useEffect(() => {
    if (!autoLoad || !isAuthenticated || loaded) return;
    void dispatch(fetchCart());
  }, [autoLoad, dispatch, isAuthenticated, loaded]);

  const refresh = useCallback(() => dispatch(fetchCart()).unwrap(), [dispatch]);

  const addItem = useCallback(
    async (productId: string, quantity: number) => {
      const result = await dispatch(addCartItem({ productId, quantity }));
      if (addCartItem.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to add item to cart.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const setItemQuantity = useCallback(
    async (cartItemId: string, quantity: number) => {
      const result = await dispatch(updateCartItemQty({ cartItemId, quantity }));
      if (updateCartItemQty.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to update cart item.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      const result = await dispatch(removeCartItem(cartItemId));
      if (removeCartItem.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to remove cart item.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const clearAll = useCallback(async () => {
    const result = await dispatch(clearCartItems());
    if (clearCartItems.rejected.match(result)) {
      throw new Error(result.payload || 'Unable to clear cart.');
    }
    return result.payload;
  }, [dispatch]);

  return {
    ...cart,
    isAuthenticated,
    refresh,
    addItem,
    setItemQuantity,
    removeItem,
    clearAll,
    getErrorMessage: getApiErrorMessage,
  };
}
