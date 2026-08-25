import { useCallback, useEffect } from 'react';
import {
  createBuyerReturn,
  fetchBuyerReturn,
  selectBuyerReturnByOrderId,
  selectBuyerReturnMissing,
  selectReturnsError,
  selectReturnsLoadingOrderId,
  selectReturnsMutating,
} from '../store/returnsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { CreateReturnPayload } from '../types/return';
import { fetchBuyerOrderDetail } from '../store/ordersSlice';

export function useBuyerOrderReturn(orderId: string | undefined, options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const returnRequest = useAppSelector(selectBuyerReturnByOrderId(orderId ?? ''));
  const missing = useAppSelector(selectBuyerReturnMissing(orderId ?? ''));
  const loadingOrderId = useAppSelector(selectReturnsLoadingOrderId);
  const mutating = useAppSelector(selectReturnsMutating);
  const error = useAppSelector(selectReturnsError);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad || !orderId) return;
    void dispatch(fetchBuyerReturn(orderId));
  }, [autoLoad, dispatch, orderId]);

  const refresh = useCallback(async () => {
    if (!orderId) throw new Error('Order id is required.');
    return dispatch(fetchBuyerReturn(orderId)).unwrap();
  }, [dispatch, orderId]);

  const submitReturn = useCallback(
    async (payload: CreateReturnPayload) => {
      if (!orderId) throw new Error('Order id is required.');
      const result = await dispatch(createBuyerReturn({ orderId, payload }));
      if (createBuyerReturn.rejected.match(result)) {
        const message =
          typeof result.payload === 'string'
            ? result.payload
            : 'Unable to submit return request.';
        throw new Error(message);
      }
      void dispatch(fetchBuyerOrderDetail(orderId));
      return result.payload.returnRequest;
    },
    [dispatch, orderId],
  );

  const loading =
    Boolean(orderId) &&
    loadingOrderId === orderId &&
    !returnRequest &&
    !missing;

  return {
    returnRequest,
    missing,
    loading,
    mutating,
    error,
    refresh,
    submitReturn,
  };
}
