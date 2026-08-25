import { useCallback, useEffect } from 'react';
import {
  approveAdminReturn,
  fetchAdminReturn,
  fetchAdminReturns,
  rejectAdminReturn,
  selectAdminReturnById,
  selectAdminReturns,
  selectAdminReturnsError,
  selectAdminReturnsFilter,
  selectAdminReturnsLoaded,
  selectAdminReturnsLoading,
  selectAdminReturnsMutating,
  selectAdminReturnsPage,
  selectAdminReturnsPageSize,
  selectAdminReturnsSummary,
  selectAdminReturnsTotalCount,
  updateAdminReturnStatus,
} from '../store/adminReturnsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type {
  AdminReturnListQuery,
  AdminReturnStatusFilter,
  RejectReturnPayload,
  UpdateReturnStatusPayload,
} from '../types/return';

function normalizeQuery(
  statusOrQuery: AdminReturnStatusFilter | AdminReturnListQuery,
): AdminReturnListQuery {
  if (typeof statusOrQuery === 'string') {
    return { status: statusOrQuery, page: 1, pageSize: 10, q: '' };
  }
  return {
    status: statusOrQuery.status ?? 'Pending',
    page: statusOrQuery.page ?? 1,
    pageSize: statusOrQuery.pageSize ?? 10,
    q: statusOrQuery.q ?? '',
  };
}

export function useAdminReturnRequests(
  statusOrQuery: AdminReturnStatusFilter | AdminReturnListQuery = 'Pending',
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectAdminReturns);
  const loadedFilter = useAppSelector(selectAdminReturnsFilter);
  const page = useAppSelector(selectAdminReturnsPage);
  const pageSize = useAppSelector(selectAdminReturnsPageSize);
  const totalCount = useAppSelector(selectAdminReturnsTotalCount);
  const summary = useAppSelector(selectAdminReturnsSummary);
  const loading = useAppSelector(selectAdminReturnsLoading);
  const mutating = useAppSelector(selectAdminReturnsMutating);
  const error = useAppSelector(selectAdminReturnsError);
  const loaded = useAppSelector(selectAdminReturnsLoaded);
  const autoLoad = options?.autoLoad ?? true;
  const listQuery = normalizeQuery(statusOrQuery);

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchAdminReturns(listQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, dispatch, listQuery.status, listQuery.page, listQuery.pageSize, listQuery.q]);

  const reload = useCallback(
    (next?: AdminReturnListQuery) => dispatch(fetchAdminReturns(next ?? listQuery)),
    [dispatch, listQuery.page, listQuery.pageSize, listQuery.q, listQuery.status],
  );

  const loadOne = useCallback(
    async (id: string) => {
      const result = await dispatch(fetchAdminReturn(id));
      if (fetchAdminReturn.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Return request not found.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const approve = useCallback(
    async (id: string) => {
      const result = await dispatch(approveAdminReturn(id));
      if (approveAdminReturn.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to approve return request.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const reject = useCallback(
    async (id: string, payload: RejectReturnPayload) => {
      const result = await dispatch(rejectAdminReturn({ id, payload }));
      if (rejectAdminReturn.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to reject return request.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const updateStatus = useCallback(
    async (id: string, payload: UpdateReturnStatusPayload) => {
      const result = await dispatch(updateAdminReturnStatus({ id, payload }));
      if (updateAdminReturnStatus.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to update return status.');
      }
      return result.payload;
    },
    [dispatch],
  );

  return {
    items,
    page,
    pageSize,
    totalCount,
    summary,
    loading,
    mutating,
    error,
    loaded,
    loadedFilter,
    reload,
    loadOne,
    approve,
    reject,
    updateStatus,
  };
}

export function useAdminReturnById(id: string | undefined) {
  return useAppSelector(selectAdminReturnById(id ?? ''));
}
