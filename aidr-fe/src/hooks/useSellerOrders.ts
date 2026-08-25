import { useCallback, useEffect, useMemo } from 'react';
import {
  fetchSellerOrderDetail,
  fetchSellerOrders,
  selectSellerOrderDetail,
  selectSellerOrdersDetailError,
  selectSellerOrdersList,
  selectSellerOrdersListError,
  selectSellerOrdersListLoading,
  selectSellerOrdersMutateError,
  selectSellerOrdersMutating,
  updateSellerOrderStatus,
} from '../store/sellerOrdersSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { SellerOrderListQuery, UpdateSellerOrderRequest } from '../types/sellerOrder';
import { getApiErrorMessage } from '../utils/apiError';

export function useSellerOrders(query: SellerOrderListQuery, options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const list = useAppSelector(selectSellerOrdersList);
  const loading = useAppSelector(selectSellerOrdersListLoading);
  const error = useAppSelector(selectSellerOrdersListError);
  const autoLoad = options?.autoLoad ?? true;

  const normalizedQuery = useMemo(
    () => ({
      status: query.status?.trim() || null,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    }),
    [query.page, query.pageSize, query.status],
  );

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchSellerOrders(normalizedQuery));
  }, [autoLoad, dispatch, normalizedQuery]);

  const refresh = useCallback(
    () => dispatch(fetchSellerOrders(normalizedQuery)).unwrap(),
    [dispatch, normalizedQuery],
  );

  const listMatches =
    list != null &&
    (list.status ?? null) === (normalizedQuery.status ?? null) &&
    list.page === normalizedQuery.page &&
    list.pageSize === normalizedQuery.pageSize;

  return {
    list: listMatches ? list : null,
    loading,
    error,
    refresh,
    getErrorMessage: getApiErrorMessage,
  };
}

export function useSellerOrderDetail(orderId: string | undefined, options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const detail = useAppSelector(selectSellerOrderDetail(orderId ?? ''));
  const error = useAppSelector(selectSellerOrdersDetailError);
  const mutating = useAppSelector(selectSellerOrdersMutating);
  const mutateError = useAppSelector(selectSellerOrdersMutateError);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad || !orderId) return;
    void dispatch(fetchSellerOrderDetail(orderId));
  }, [autoLoad, dispatch, orderId]);

  const refresh = useCallback(async () => {
    if (!orderId) throw new Error('Order id is required.');
    return dispatch(fetchSellerOrderDetail(orderId)).unwrap();
  }, [dispatch, orderId]);

  const updateStatus = useCallback(
    async (request: UpdateSellerOrderRequest) => {
      if (!orderId) throw new Error('Order id is required.');
      const result = await dispatch(updateSellerOrderStatus({ orderId, request }));
      if (updateSellerOrderStatus.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to update order status.');
      }
      return result.payload;
    },
    [dispatch, orderId],
  );

  const matchedDetail = detail && detail.orderId === orderId ? detail : null;

  return {
    detail: matchedDetail,
    loading: Boolean(orderId) && !matchedDetail && !error,
    error,
    mutating,
    mutateError,
    refresh,
    updateStatus,
    getErrorMessage: getApiErrorMessage,
  };
}
