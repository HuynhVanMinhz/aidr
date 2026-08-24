import { useCallback } from 'react';
import {
  adjustSellerInventory,
  fetchSellerInventory,
  fetchSellerInventoryDetail,
  importSellerStockLot,
  selectSellerInventoryDetailError,
  selectSellerInventoryDetailLoading,
  selectSellerInventoryItems,
  selectSellerInventoryListError,
  selectSellerInventoryListLoading,
  selectSellerInventoryPaging,
  selectSellerInventorySummary,
  selectSellerMutating,
  selectSellerSelectedInventory,
  updateSellerInventorySettings,
  updateSellerSellingPrice,
} from '../store/sellerSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type {
  AdjustSellerInventoryPayload,
  ImportStockLotPayload,
  SellerInventoryQuery,
  UpdateSellerInventoryPayload,
  UpdateSellingPricePayload,
} from '../types/sellerInventory';
import { getApiErrorMessage } from '../utils/apiError';

export function useSellerInventory() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectSellerInventoryItems);
  const paging = useAppSelector(selectSellerInventoryPaging);
  const summary = useAppSelector(selectSellerInventorySummary);
  const listLoading = useAppSelector(selectSellerInventoryListLoading);
  const listError = useAppSelector(selectSellerInventoryListError);
  const detail = useAppSelector(selectSellerSelectedInventory);
  const detailLoading = useAppSelector(selectSellerInventoryDetailLoading);
  const detailError = useAppSelector(selectSellerInventoryDetailError);
  const mutating = useAppSelector(selectSellerMutating);

  const loadList = useCallback(
    (query: SellerInventoryQuery) => dispatch(fetchSellerInventory(query)),
    [dispatch],
  );

  const loadOne = useCallback(
    async (productId: string) => {
      const result = await dispatch(fetchSellerInventoryDetail(productId));
      if (fetchSellerInventoryDetail.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Inventory not found.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const updateThreshold = useCallback(
    async (productId: string, payload: UpdateSellerInventoryPayload) => {
      const result = await dispatch(updateSellerInventorySettings({ productId, payload }));
      if (updateSellerInventorySettings.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to update inventory settings.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const adjust = useCallback(
    async (productId: string, payload: AdjustSellerInventoryPayload) => {
      const result = await dispatch(adjustSellerInventory({ productId, payload }));
      if (adjustSellerInventory.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to adjust inventory.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const importLot = useCallback(
    async (productId: string, payload: ImportStockLotPayload) => {
      const result = await dispatch(importSellerStockLot({ productId, payload }));
      if (importSellerStockLot.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to import stock lot.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const updatePrice = useCallback(
    async (productId: string, payload: UpdateSellingPricePayload) => {
      const result = await dispatch(updateSellerSellingPrice({ productId, payload }));
      if (updateSellerSellingPrice.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to update selling price.');
      }
      return result.payload;
    },
    [dispatch],
  );

  return {
    items,
    paging,
    summary,
    listLoading,
    listError,
    detail,
    detailLoading,
    detailError,
    mutating,
    loadList,
    loadOne,
    updateThreshold,
    adjust,
    importLot,
    updatePrice,
    getErrorMessage: getApiErrorMessage,
  };
}
