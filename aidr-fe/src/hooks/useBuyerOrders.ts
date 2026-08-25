import { useCallback, useEffect, useMemo } from 'react';
import {
  cancelBuyerOrder,
  confirmBuyerOrderReceived,
  fetchBuyerOrderDetail,
  fetchBuyerOrders,
  selectOrderDetail,
  selectOrdersDetailError,
  selectOrdersList,
  selectOrdersListError,
  selectOrdersListLoading,
  selectOrdersMutateError,
  selectOrdersMutating,
} from '../store/ordersSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { BuyerOrderListQuery } from '../types/order';
import { getApiErrorMessage } from '../utils/apiError';

export function useBuyerOrders(query: BuyerOrderListQuery, options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const list = useAppSelector(selectOrdersList);
  const loading = useAppSelector(selectOrdersListLoading);
  const error = useAppSelector(selectOrdersListError);
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
    void dispatch(fetchBuyerOrders(normalizedQuery));
  }, [autoLoad, dispatch, normalizedQuery]);

  const refresh = useCallback(
    () => dispatch(fetchBuyerOrders(normalizedQuery)).unwrap(),
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

export function useBuyerOrderDetail(orderId: string | undefined, options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const detail = useAppSelector(selectOrderDetail(orderId ?? ''));
  const error = useAppSelector(selectOrdersDetailError);
  const mutating = useAppSelector(selectOrdersMutating);
  const mutateError = useAppSelector(selectOrdersMutateError);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad || !orderId) return;
    void dispatch(fetchBuyerOrderDetail(orderId));
  }, [autoLoad, dispatch, orderId]);

  const refresh = useCallback(async () => {
    if (!orderId) throw new Error('Order id is required.');
    return dispatch(fetchBuyerOrderDetail(orderId)).unwrap();
  }, [dispatch, orderId]);

  const cancel = useCallback(
    async (reason?: string | null) => {
      if (!orderId) throw new Error('Order id is required.');
      const result = await dispatch(cancelBuyerOrder({ orderId, reason }));
      if (cancelBuyerOrder.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to cancel order.');
      }
      return result.payload;
    },
    [dispatch, orderId],
  );

  const confirmReceived = useCallback(async () => {
    if (!orderId) throw new Error('Order id is required.');
    const result = await dispatch(confirmBuyerOrderReceived(orderId));
    if (confirmBuyerOrderReceived.rejected.match(result)) {
      throw new Error(result.payload || 'Unable to confirm order received.');
    }
    return result.payload;
  }, [dispatch, orderId]);

  const matchedDetail = detail && detail.orderId === orderId ? detail : null;

  return {
    detail: matchedDetail,
    loading: Boolean(orderId) && !matchedDetail && !error,
    error,
    mutating,
    mutateError,
    refresh,
    cancel,
    confirmReceived,
    getErrorMessage: getApiErrorMessage,
  };
}
