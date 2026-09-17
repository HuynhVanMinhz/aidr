import { useCallback, useEffect, useState } from 'react';
import * as returnApi from '../services/returnApi';
import type {
  ConfirmSellerReturnPayload,
  RejectSellerReturnPayload,
  SellerReturnActionPayload,
  SellerReturnDetail,
  SellerReturnListResult,
} from '../types/return';
import { getApiErrorMessage } from '../utils/apiError';

export function useSellerReturns(query: {
  status?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const [list, setList] = useState<SellerReturnListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await returnApi.listSellerReturns(query);
      setList(returnApi.requireSellerReturnList(result));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load return requests.'));
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [query.page, query.pageSize, query.status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { list, loading, error, mutating, setMutating, reload };
}

export function useSellerReturnDetail(id: string | undefined) {
  const [item, setItem] = useState<SellerReturnDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await returnApi.getSellerReturn(id);
      setItem(returnApi.requireSellerReturnDetail(result));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Return request not found.'));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = useCallback(
    async (action: () => Promise<SellerReturnDetail>) => {
      setMutating(true);
      setError(null);
      try {
        const updated = await action();
        setItem(updated);
        return updated;
      } catch (err) {
        const message = getApiErrorMessage(err, 'Unable to update return request.');
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setMutating(false);
      }
    },
    [],
  );

  const confirm = useCallback(
    (payload: ConfirmSellerReturnPayload = {}) =>
      runAction(async () => {
        const result = await returnApi.confirmSellerReturn(id!, payload);
        return returnApi.requireSellerReturnDetail(result);
      }),
    [id, runAction],
  );

  const markReceiving = useCallback(
    (payload: SellerReturnActionPayload = {}) =>
      runAction(async () => {
        const result = await returnApi.markSellerReturnReceiving(id!, payload);
        return returnApi.requireSellerReturnDetail(result);
      }),
    [id, runAction],
  );

  const acceptGoods = useCallback(
    (payload: SellerReturnActionPayload = {}) =>
      runAction(async () => {
        const result = await returnApi.acceptSellerReturnGoods(id!, payload);
        return returnApi.requireSellerReturnDetail(result);
      }),
    [id, runAction],
  );

  const reject = useCallback(
    (payload: RejectSellerReturnPayload) =>
      runAction(async () => {
        const result = await returnApi.rejectSellerReturn(id!, payload);
        return returnApi.requireSellerReturnDetail(result);
      }),
    [id, runAction],
  );

  return {
    item,
    loading,
    mutating,
    error,
    reload,
    confirm,
    markReceiving,
    acceptGoods,
    reject,
  };
}
