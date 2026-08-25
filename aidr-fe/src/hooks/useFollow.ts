import { useCallback, useEffect, useMemo } from 'react';
import { selectIsAuthenticated } from '../store/authSlice';
import {
  fetchFollowedShops,
  fetchFollowMembership,
  followShop,
  selectFollow,
  selectFollowMembershipLoaded,
  selectIsFollowingShop,
  unfollowShop,
} from '../store/followSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { FollowListQuery } from '../types/follow';
import { getApiErrorMessage } from '../utils/apiError';

export function useFollowedShops(query?: FollowListQuery, options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const follow = useAppSelector(selectFollow);
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
    void dispatch(fetchFollowedShops(normalizedQuery));
  }, [autoLoad, dispatch, isAuthenticated, normalizedQuery]);

  const refresh = useCallback(
    () => dispatch(fetchFollowedShops(normalizedQuery)).unwrap(),
    [dispatch, normalizedQuery],
  );

  const followShopById = useCallback(
    async (shopId: string) => {
      const result = await dispatch(followShop(shopId));
      if (followShop.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to follow shop.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const unfollowShopById = useCallback(
    async (shopId: string) => {
      const result = await dispatch(unfollowShop(shopId));
      if (unfollowShop.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to unfollow shop.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const toggleShop = useCallback(
    async (shopId: string, currentlyFollowing: boolean) => {
      if (currentlyFollowing) {
        return unfollowShopById(shopId);
      }
      return followShopById(shopId);
    },
    [followShopById, unfollowShopById],
  );

  return {
    ...follow,
    isAuthenticated,
    refresh,
    followShop: followShopById,
    unfollowShop: unfollowShopById,
    toggleShop,
    getErrorMessage: getApiErrorMessage,
  };
}

export function useFollowMembership(options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const membershipLoaded = useAppSelector(selectFollowMembershipLoaded);
  const follow = useAppSelector(selectFollow);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad || !isAuthenticated || membershipLoaded) return;
    void dispatch(fetchFollowMembership());
  }, [autoLoad, dispatch, isAuthenticated, membershipLoaded]);

  return {
    shopIds: follow.shopIds,
    totalCount: follow.totalCount,
    membershipLoaded,
    isAuthenticated,
  };
}

export function useFollowShop(shopId: string | undefined) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isFollowing = useAppSelector(selectIsFollowingShop(shopId ?? ''));
  const mutating = useAppSelector((state) => state.follow.mutating);
  const membershipLoaded = useAppSelector(selectFollowMembershipLoaded);

  useEffect(() => {
    if (!shopId || !isAuthenticated || membershipLoaded) return;
    void dispatch(fetchFollowMembership());
  }, [dispatch, isAuthenticated, membershipLoaded, shopId]);

  const followShopById = useCallback(async () => {
    if (!shopId) throw new Error('Shop id is required.');
    const result = await dispatch(followShop(shopId));
    if (followShop.rejected.match(result)) {
      throw new Error(result.payload || 'Unable to follow shop.');
    }
    return result.payload;
  }, [dispatch, shopId]);

  const unfollowShopById = useCallback(async () => {
    if (!shopId) throw new Error('Shop id is required.');
    const result = await dispatch(unfollowShop(shopId));
    if (unfollowShop.rejected.match(result)) {
      throw new Error(result.payload || 'Unable to unfollow shop.');
    }
    return result.payload;
  }, [dispatch, shopId]);

  const toggle = useCallback(async () => {
    if (isFollowing) return unfollowShopById();
    return followShopById();
  }, [followShopById, isFollowing, unfollowShopById]);

  return {
    isFollowing,
    mutating,
    isAuthenticated,
    membershipLoaded,
    followShop: followShopById,
    unfollowShop: unfollowShopById,
    toggle,
    getErrorMessage: getApiErrorMessage,
  };
}
