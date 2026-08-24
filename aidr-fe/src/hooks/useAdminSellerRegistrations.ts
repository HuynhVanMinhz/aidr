import { useCallback, useEffect } from 'react';
import {
  approveSellerRegistration,
  fetchSellerRegistration,
  fetchSellerRegistrations,
  rejectSellerRegistration,
  selectSellerRegistrationById,
  selectSellerRegistrations,
  selectSellerRegistrationsError,
  selectSellerRegistrationsFilter,
  selectSellerRegistrationsLoaded,
  selectSellerRegistrationsLoading,
  selectSellerRegistrationsMutating,
} from '../store/adminSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { RejectSellerRegistrationPayload, SellerRegistrationStatusFilter } from '../types/admin';

export function useAdminSellerRegistrations(
  status: SellerRegistrationStatusFilter = 'Pending',
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectSellerRegistrations);
  const loadedFilter = useAppSelector(selectSellerRegistrationsFilter);
  const loading = useAppSelector(selectSellerRegistrationsLoading);
  const mutating = useAppSelector(selectSellerRegistrationsMutating);
  const error = useAppSelector(selectSellerRegistrationsError);
  const loaded = useAppSelector(selectSellerRegistrationsLoaded);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad) return;
    const needsLoad = !loaded || loadedFilter !== status;
    if (needsLoad && !loading) {
      void dispatch(fetchSellerRegistrations(status));
    }
  }, [autoLoad, dispatch, loaded, loadedFilter, loading, status]);

  const reload = useCallback(
    (nextStatus: SellerRegistrationStatusFilter = status) =>
      dispatch(fetchSellerRegistrations(nextStatus)),
    [dispatch, status],
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

  return {
    items,
    loading,
    mutating,
    error,
    loaded,
    loadedFilter,
    reload,
    loadOne,
    approve,
    reject,
  };
}

export function useSellerRegistrationById(id: string | undefined) {
  return useAppSelector(selectSellerRegistrationById(id ?? ''));
}
