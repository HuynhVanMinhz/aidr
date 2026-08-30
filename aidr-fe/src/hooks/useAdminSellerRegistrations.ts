import { useCallback, useEffect } from 'react';
import {
  approveSellerRegistration,
  fetchSellerRegistration,
  fetchSellerRegistrations,
  rejectSellerRegistration,
  requestMoreInfoOnSellerRegistration,
  selectSellerRegistrationById,
  selectSellerRegistrations,
  selectSellerRegistrationsError,
  selectSellerRegistrationsFilter,
  selectSellerRegistrationsLoaded,
  selectSellerRegistrationsLoading,
  selectSellerRegistrationsMutating,
  selectSellerRegistrationsPage,
  selectSellerRegistrationsPageSize,
  selectSellerRegistrationsSummary,
  selectSellerRegistrationsTotalCount,
} from '../store/adminSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type {
  RejectSellerRegistrationPayload,
  SellerRegistrationListQuery,
  SellerRegistrationStatusFilter,
} from '../types/admin';

function normalizeQuery(
  statusOrQuery: SellerRegistrationStatusFilter | SellerRegistrationListQuery,
): SellerRegistrationListQuery {
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

export function useAdminSellerRegistrations(
  statusOrQuery: SellerRegistrationStatusFilter | SellerRegistrationListQuery = 'Pending',
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectSellerRegistrations);
  const loadedFilter = useAppSelector(selectSellerRegistrationsFilter);
  const page = useAppSelector(selectSellerRegistrationsPage);
  const pageSize = useAppSelector(selectSellerRegistrationsPageSize);
  const totalCount = useAppSelector(selectSellerRegistrationsTotalCount);
  const summary = useAppSelector(selectSellerRegistrationsSummary);
  const loading = useAppSelector(selectSellerRegistrationsLoading);
  const mutating = useAppSelector(selectSellerRegistrationsMutating);
  const error = useAppSelector(selectSellerRegistrationsError);
  const loaded = useAppSelector(selectSellerRegistrationsLoaded);
  const autoLoad = options?.autoLoad ?? true;
  const listQuery = normalizeQuery(statusOrQuery);

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchSellerRegistrations(listQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, dispatch, listQuery.status, listQuery.page, listQuery.pageSize, listQuery.q]);

  const reload = useCallback(
    (next?: SellerRegistrationListQuery) =>
      dispatch(fetchSellerRegistrations(next ?? listQuery)),
    [dispatch, listQuery.page, listQuery.pageSize, listQuery.q, listQuery.status],
  );

  const loadOne = useCallback(
    async (id: string) => {
      const result = await dispatch(fetchSellerRegistration(id));
      if (fetchSellerRegistration.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Seller registration request not found.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const approve = useCallback(
    async (id: string) => {
      const result = await dispatch(approveSellerRegistration(id));
      if (approveSellerRegistration.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to approve seller registration.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const reject = useCallback(
    async (id: string, payload: RejectSellerRegistrationPayload) => {
      const result = await dispatch(rejectSellerRegistration({ id, payload }));
      if (rejectSellerRegistration.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to reject seller registration.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const requestMoreInfo = useCallback(
    async (id: string, payload: RejectSellerRegistrationPayload) => {
      const result = await dispatch(requestMoreInfoOnSellerRegistration({ id, payload }));
      if (requestMoreInfoOnSellerRegistration.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to send this application back.');
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
    requestMoreInfo,
  };
}

export function useSellerRegistrationById(id: string | undefined) {
  return useAppSelector(selectSellerRegistrationById(id ?? ''));
}
