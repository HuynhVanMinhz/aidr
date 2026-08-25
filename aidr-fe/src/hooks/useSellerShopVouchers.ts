import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  createSellerShopVoucher,
  deleteSellerShopVoucher,
  fetchSellerShopVoucher,
  fetchSellerShopVouchers,
  selectSellerShopVoucherById,
  selectSellerShopVoucherPage,
  selectSellerShopVoucherPageSize,
  selectSellerShopVoucherSummary,
  selectSellerShopVoucherTotalCount,
  selectSellerShopVouchers,
  selectSellerShopVouchersError,
  selectSellerShopVouchersLoading,
  selectSellerShopVouchersMutating,
  updateSellerShopVoucher,
  updateSellerShopVoucherStatus,
} from '../store/sellerVoucherSlice';
import type {
  CreateShopVoucherPayload,
  SellerShopVoucherListQuery,
  UpdateShopVoucherPayload,
} from '../types/seller';
import { getApiErrorMessage } from '../utils/apiError';

export function useSellerShopVouchers(
  query?: SellerShopVoucherListQuery,
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectSellerShopVouchers);
  const page = useAppSelector(selectSellerShopVoucherPage);
  const pageSize = useAppSelector(selectSellerShopVoucherPageSize);
  const totalCount = useAppSelector(selectSellerShopVoucherTotalCount);
  const summary = useAppSelector(selectSellerShopVoucherSummary);
  const loading = useAppSelector(selectSellerShopVouchersLoading);
  const mutating = useAppSelector(selectSellerShopVouchersMutating);
  const error = useAppSelector(selectSellerShopVouchersError);
  const autoLoad = options?.autoLoad ?? true;

  const listQuery: SellerShopVoucherListQuery = {
    q: query?.q,
    isActive: query?.isActive,
    page: query?.page ?? 1,
    pageSize: query?.pageSize ?? 10,
  };

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchSellerShopVouchers(listQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when list filters change
  }, [autoLoad, dispatch, listQuery.q, listQuery.isActive, listQuery.page, listQuery.pageSize]);

  const reload = useCallback(
    (next?: SellerShopVoucherListQuery) => dispatch(fetchSellerShopVouchers(next ?? listQuery)),
    [dispatch, listQuery],
  );

  const create = useCallback(
    async (payload: CreateShopVoucherPayload) => {
      const result = await dispatch(createSellerShopVoucher(payload));
      if (createSellerShopVoucher.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to create voucher.',
        );
      }
      return result.payload;
    },
    [dispatch],
  );

  const update = useCallback(
    async (id: string, payload: UpdateShopVoucherPayload) => {
      const result = await dispatch(updateSellerShopVoucher({ id, payload }));
      if (updateSellerShopVoucher.rejected.match(result)) {
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
      const result = await dispatch(updateSellerShopVoucherStatus({ id, isActive }));
      if (updateSellerShopVoucherStatus.rejected.match(result)) {
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
      const result = await dispatch(deleteSellerShopVoucher(id));
      if (deleteSellerShopVoucher.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to delete voucher.',
        );
      }
    },
    [dispatch],
  );

  const loadOne = useCallback(
    async (id: string) => {
      const result = await dispatch(fetchSellerShopVoucher(id));
      if (fetchSellerShopVoucher.rejected.match(result)) {
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

export function useSellerShopVoucherDetail(id: string | undefined) {
  return useAppSelector(selectSellerShopVoucherById(id ?? ''));
}
