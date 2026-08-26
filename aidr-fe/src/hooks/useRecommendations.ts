import { useEffect } from 'react';
import { useAuth } from './useAuth';
import {
  fetchRecommendations,
  fetchSimilarProducts,
  selectRecommendations,
  selectRecommendationsAuthKey,
  selectRecommendationsError,
  selectRecommendationsLoading,
  selectSimilarError,
  selectSimilarLoaded,
  selectSimilarLoading,
  selectSimilarProducts,
} from '../store/recommendationSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

export function useRecommendations(options?: { pageSize?: number; enabled?: boolean }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, accessToken } = useAuth();
  const items = useAppSelector(selectRecommendations);
  const loading = useAppSelector(selectRecommendationsLoading);
  const error = useAppSelector(selectRecommendationsError);
  const loadedForAuthKey = useAppSelector(selectRecommendationsAuthKey);
  const enabled = options?.enabled !== false;
  const pageSize = options?.pageSize ?? 12;
  const authKey = isAuthenticated ? `user:${accessToken?.slice(-12) ?? 'auth'}` : 'anon';

  useEffect(() => {
    if (!enabled) return;
    if (loadedForAuthKey === authKey) return;
    void dispatch(fetchRecommendations({ page: 1, pageSize, authKey }));
  }, [authKey, dispatch, enabled, loadedForAuthKey, pageSize]);

  return { items, loading, error };
}

export function useSimilarProducts(productId: string | undefined, options?: { limit?: number }) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectSimilarProducts(productId ?? ''));
  const loaded = useAppSelector(selectSimilarLoaded(productId ?? ''));
  const loading = useAppSelector(selectSimilarLoading(productId ?? ''));
  const error = useAppSelector(selectSimilarError);
  const limit = options?.limit ?? 12;

  useEffect(() => {
    if (!productId || loaded) return;
    void dispatch(fetchSimilarProducts({ productId, limit }));
  }, [dispatch, limit, loaded, productId]);

  return {
    items,
    loading: Boolean(productId) && !loaded && (loading || !error),
    error: loaded ? error : null,
  };
}
