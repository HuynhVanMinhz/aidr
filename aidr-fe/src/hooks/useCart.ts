import { useCallback, useEffect, useMemo } from 'react';
import { selectIsAuthenticated } from '../store/authSlice';
import {
  addCartItem,
  clearCartItems,
  clearCartSelection,
  fetchCart,
  removeCartItem,
  selectAllCartItems,
  selectCart,
  selectCartLoaded,
  selectOnlyCartItem,
  toggleCartSelection,
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
    async (productId: string, quantity: number, variantId?: string | null) => {
      const result = await dispatch(addCartItem({ productId, variantId, quantity }));
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

  /**
   * Check out one product line without stacking onto an existing cart quantity
   * (add would merge and double qty when the item is already in the cart).
   */
  const buyNow = useCallback(
    async (productId: string, quantity: number, variantId?: string | null) => {
      const sameLine = (i: { productId: string; variantId?: string | null }) =>
        i.productId === productId && (i.variantId ?? null) === (variantId ?? null);

      // Cart may not be loaded yet (e.g. Buy Now from a product card).
      let items = cart.items;
      if (!loaded) {
        const fresh = await refresh();
        items = fresh.items;
      }

      const existing = items.find(sameLine);
      if (existing) {
        let line = existing;
        // Honour a higher Buy Now qty without shrinking what the buyer already saved.
        if (existing.quantity < quantity) {
          const updated = await setItemQuantity(existing.cartItemId, quantity);
          line = updated.items.find(sameLine) ?? existing;
        }
        dispatch(selectOnlyCartItem(line.cartItemId));
        return line;
      }

      const updated = await addItem(productId, quantity, variantId);
      const line = updated.items.find(sameLine);
      if (!line) {
        throw new Error('Unable to start checkout for this product.');
      }
      dispatch(selectOnlyCartItem(line.cartItemId));
      return line;
    },
    [addItem, cart.items, dispatch, loaded, refresh, setItemQuantity],
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

  const toggleSelected = useCallback(
    (cartItemId: string) => dispatch(toggleCartSelection(cartItemId)),
    [dispatch],
  );
  const selectAll = useCallback(() => dispatch(selectAllCartItems()), [dispatch]);
  const clearSelection = useCallback(() => dispatch(clearCartSelection()), [dispatch]);

  const selectedIdSet = useMemo(() => new Set(cart.selectedIds), [cart.selectedIds]);
  const selectedItems = useMemo(
    () => cart.items.filter((item) => item.isAvailable && selectedIdSet.has(item.cartItemId)),
    [cart.items, selectedIdSet],
  );
  const selectableCount = useMemo(
    () => cart.items.filter((item) => item.isAvailable).length,
    [cart.items],
  );

  return {
    ...cart,
    isAuthenticated,
    refresh,
    addItem,
    buyNow,
    setItemQuantity,
    removeItem,
    clearAll,
    selectedItems,
    selectableCount,
    isSelected: useCallback((cartItemId: string) => selectedIdSet.has(cartItemId), [selectedIdSet]),
    toggleSelected,
    selectAll,
    clearSelection,
    getErrorMessage: getApiErrorMessage,
  };
}
