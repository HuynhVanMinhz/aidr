import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  createAdminSystemVoucher,
  deleteAdminSystemVoucher,
  fetchAdminSystemVoucher,
  fetchAdminSystemVouchers,
  selectAdminSystemVoucherById,
  selectAdminSystemVoucherPage,
  selectAdminSystemVoucherPageSize,
  selectAdminSystemVoucherSummary,
  selectAdminSystemVoucherTotalCount,
  selectAdminSystemVouchers,
  selectAdminSystemVouchersError,
  selectAdminSystemVouchersLoading,
  selectAdminSystemVouchersMutating,
  updateAdminSystemVoucher,
  updateAdminSystemVoucherStatus,
} from '../store/adminVoucherSlice';
import type {
  AdminSystemVoucherListQuery,
  CreateSystemVoucherPayload,
  UpdateSystemVoucherPayload,
} from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export function useAdminSystemVouchers(
  query?: AdminSystemVoucherListQuery,
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectAdminSystemVouchers);
  const page = useAppSelector(selectAdminSystemVoucherPage);
  const pageSize = useAppSelector(selectAdminSystemVoucherPageSize);
  const totalCount = useAppSelector(selectAdminSystemVoucherTotalCount);
  const summary = useAppSelector(selectAdminSystemVoucherSummary);
  const loading = useAppSelector(selectAdminSystemVouchersLoading);
  const mutating = useAppSelector(selectAdminSystemVouchersMutating);
  const error = useAppSelector(selectAdminSystemVouchersError);
  const autoLoad = options?.autoLoad ?? true;

  const listQuery: AdminSystemVoucherListQuery = {
    q: query?.q,
    isActive: query?.isActive,
    page: query?.page ?? 1,
    pageSize: query?.pageSize ?? 10,
  };

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchAdminSystemVouchers(listQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when list filters change
  }, [autoLoad, dispatch, listQuery.q, listQuery.isActive, listQuery.page, listQuery.pageSize]);

  const reload = useCallback(
    (next?: AdminSystemVoucherListQuery) => dispatch(fetchAdminSystemVouchers(next ?? listQuery)),
    [dispatch, listQuery],
  );

  const create = useCallback(
    async (payload: CreateSystemVoucherPayload) => {
      const result = await dispatch(createAdminSystemVoucher(payload));
      if (createAdminSystemVoucher.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to create voucher.',
        );
      }
      return result.payload;
    },
    [dispatch],
  );

  const update = useCallback(
    async (id: string, payload: UpdateSystemVoucherPayload) => {
      const result = await dispatch(updateAdminSystemVoucher({ id, payload }));
      if (updateAdminSystemVoucher.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to update voucher.',
        );
      }
      return result.payload;
    },
    [dispatch],
  );

  const setStatus = useCallback(
    async (id: string, isActive: boolean) => {
      const result = await dispatch(updateAdminSystemVoucherStatus({ id, isActive }));
      if (updateAdminSystemVoucherStatus.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to update voucher status.',
        );
      }
      return result.payload;
    },
    [dispatch],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await dispatch(deleteAdminSystemVoucher(id));
      if (deleteAdminSystemVoucher.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to delete voucher.',
        );
      }
    },
    [dispatch],
  );

  const loadOne = useCallback(
    async (id: string) => {
      const result = await dispatch(fetchAdminSystemVoucher(id));
      if (fetchAdminSystemVoucher.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to load voucher.',
        );
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
    reload,
    create,
    update,
    setStatus,
    remove,
    loadOne,
    getErrorMessage: getApiErrorMessage,
  };
}

export function useAdminSystemVoucherDetail(id: string | undefined) {
  return useAppSelector(selectAdminSystemVoucherById(id ?? ''));
}
