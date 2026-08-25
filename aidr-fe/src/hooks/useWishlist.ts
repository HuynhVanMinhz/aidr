import { useCallback, useEffect, useMemo } from 'react';
import { selectIsAuthenticated } from '../store/authSlice';
import {
  addWishlistItem,
  fetchWishlist,
  fetchWishlistMembership,
  removeWishlistItem,
  removeWishlistProduct,
  selectIsInWishlist,
  selectWishlist,
  selectWishlistMembershipLoaded,
} from '../store/wishlistSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { WishlistListQuery } from '../types/wishlist';
import { getApiErrorMessage } from '../utils/apiError';

export function useWishlist(query?: WishlistListQuery, options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const wishlist = useAppSelector(selectWishlist);
  const autoLoad = options?.autoLoad ?? false;

  const normalizedQuery = useMemo(
    () => ({
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    }),
    [query?.page, query?.pageSize],
  );

  useEffect(() => {
    if (!autoLoad || !isAuthenticated) return;
    void dispatch(fetchWishlist(normalizedQuery));
  }, [autoLoad, dispatch, isAuthenticated, normalizedQuery]);

  const refresh = useCallback(
    () => dispatch(fetchWishlist(normalizedQuery)).unwrap(),
    [dispatch, normalizedQuery],
  );

  const addItem = useCallback(
    async (productId: string) => {
      const result = await dispatch(addWishlistItem(productId));
      if (addWishlistItem.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to add product to wishlist.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const removeItem = useCallback(
    async (wishlistItemId: string) => {
      const result = await dispatch(removeWishlistItem(wishlistItemId));
      if (removeWishlistItem.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to remove product from wishlist.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const removeProduct = useCallback(
    async (productId: string) => {
      const result = await dispatch(removeWishlistProduct(productId));
      if (removeWishlistProduct.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to remove product from wishlist.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const toggleProduct = useCallback(
    async (productId: string, currentlyInWishlist: boolean) => {
      if (currentlyInWishlist) {
        return removeProduct(productId);
      }
      return addItem(productId);
    },
    [addItem, removeProduct],
  );

  return {
    ...wishlist,
    isAuthenticated,
    refresh,
    addItem,
    removeItem,
    removeProduct,
    toggleProduct,
    getErrorMessage: getApiErrorMessage,
  };
}

/** Prefetch product-id membership for header / catalog CTAs. */
export function useWishlistMembership(options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const membershipLoaded = useAppSelector(selectWishlistMembershipLoaded);
  const wishlist = useAppSelector(selectWishlist);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad || !isAuthenticated || membershipLoaded) return;
    void dispatch(fetchWishlistMembership());
  }, [autoLoad, dispatch, isAuthenticated, membershipLoaded]);

  return {
    productIds: wishlist.productIds,
    totalCount: wishlist.totalCount,
    membershipLoaded,
    isAuthenticated,
  };
}

export function useWishlistProduct(productId: string | undefined) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const inWishlist = useAppSelector(selectIsInWishlist(productId ?? ''));
  const mutating = useAppSelector((state) => state.wishlist.mutating);

  const addItem = useCallback(async () => {
    if (!productId) throw new Error('Product id is required.');
    const result = await dispatch(addWishlistItem(productId));
    if (addWishlistItem.rejected.match(result)) {
      throw new Error(result.payload || 'Unable to add product to wishlist.');
    }
    return result.payload;
  }, [dispatch, productId]);

  const removeProduct = useCallback(async () => {
    if (!productId) throw new Error('Product id is required.');
    const result = await dispatch(removeWishlistProduct(productId));
    if (removeWishlistProduct.rejected.match(result)) {
      throw new Error(result.payload || 'Unable to remove product from wishlist.');
    }
    return result.payload;
  }, [dispatch, productId]);

  const toggle = useCallback(async () => {
    if (inWishlist) return removeProduct();
    return addItem();
  }, [addItem, inWishlist, removeProduct]);

  return {
    inWishlist,
    mutating,
    isAuthenticated,
    addItem,
    removeProduct,
    toggle,
    getErrorMessage: getApiErrorMessage,
  };
}
