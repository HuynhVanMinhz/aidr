import { useCallback, useEffect, useMemo } from 'react';
import { selectIsAuthenticated } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  clearAppliedVouchers,
  fetchVouchers,
  previewAndApplyVoucher,
  refreshAppliedVouchers,
  removeAppliedVoucher,
  selectAppliedDiscountTotal,
  selectAppliedVouchers,
  selectVoucher,
  setVoucherCodeInput,
} from '../store/voucherSlice';
import type { OrderVoucherSelection, VoucherListItem } from '../types/voucher';
import { getApiErrorMessage } from '../utils/apiError';

type UseVouchersOptions = {
  autoLoad?: boolean;
  cartItemIds?: string[] | null;
};

export function useVouchers(options?: UseVouchersOptions) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const voucher = useAppSelector(selectVoucher);
  const applied = useAppSelector(selectAppliedVouchers);
  const discountTotal = useAppSelector(selectAppliedDiscountTotal);
  const autoLoad = options?.autoLoad ?? false;
  const cartItemIds = options?.cartItemIds;

  const cartItemKey = useMemo(
    () => (cartItemIds?.length ? [...cartItemIds].sort().join(',') : ''),
    [cartItemIds],
  );

  useEffect(() => {
    if (!autoLoad || !isAuthenticated) return;
    void dispatch(
      fetchVouchers({
        cartItemIds: cartItemIds?.length ? cartItemIds : null,
        page: 1,
        pageSize: 20,
      }),
    );
  }, [autoLoad, cartItemKey, dispatch, isAuthenticated]);

  useEffect(() => {
    if (!autoLoad || !isAuthenticated) return;
    if (Object.keys(voucher.appliedByShopId).length === 0) return;
    void dispatch(
      refreshAppliedVouchers({
        cartItemIds: cartItemIds?.length ? cartItemIds : null,
      }),
    );
  }, [autoLoad, cartItemKey, dispatch, isAuthenticated]);

  const refresh = useCallback(() => {
    return dispatch(
      fetchVouchers({
        cartItemIds: cartItemIds?.length ? cartItemIds : null,
        page: 1,
        pageSize: 20,
      }),
    ).unwrap();
  }, [cartItemIds, dispatch]);

  const setCodeInput = useCallback(
    (value: string) => {
      dispatch(setVoucherCodeInput(value));
    },
    [dispatch],
  );

  const applyCode = useCallback(
    async (code: string, shopId?: string | null) => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error('Please enter a voucher code.');
      const result = await dispatch(
        previewAndApplyVoucher({
          code: trimmed,
          shopId: shopId || null,
          cartItemIds: cartItemIds?.length ? cartItemIds : null,
        }),
      );
      if (previewAndApplyVoucher.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to apply voucher.');
      }
      return result.payload;
    },
    [cartItemIds, dispatch],
  );

  const applyVoucher = useCallback(
    async (item: VoucherListItem, shopId?: string | null) => {
      const resolvedShopId =
        shopId ||
        item.shopId ||
        null;
      const result = await dispatch(
        previewAndApplyVoucher({
          voucherId: item.voucherId,
          shopId: resolvedShopId,
          cartItemIds: cartItemIds?.length ? cartItemIds : null,
        }),
      );
      if (previewAndApplyVoucher.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to apply voucher.');
      }
      return result.payload;
    },
    [cartItemIds, dispatch],
  );

  const remove = useCallback(
    (shopId: string) => {
      dispatch(removeAppliedVoucher(shopId));
    },
    [dispatch],
  );

  const clearAll = useCallback(() => {
    dispatch(clearAppliedVouchers());
  }, [dispatch]);

  const orderSelections: OrderVoucherSelection[] = useMemo(
    () =>
      applied.map((v) => ({
        shopId: v.shopId,
        voucherId: v.voucherId,
      })),
    [applied],
  );

  return {
    ...voucher,
    applied,
    discountTotal,
    orderSelections,
    isAuthenticated,
    refresh,
    setCodeInput,
    applyCode,
    applyVoucher,
    remove,
    clearAll,
    getErrorMessage: getApiErrorMessage,
  };
}
