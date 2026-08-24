import { useCallback, useEffect } from 'react';
import {
  approveAdminProduct,
  fetchAdminProduct,
  fetchAdminProducts,
  fetchProductModerationHistory,
  rejectAdminProduct,
  selectAdminProductDetailById,
  selectAdminProducts,
  selectAdminProductsError,
  selectAdminProductsFilter,
  selectAdminProductsLoaded,
  selectAdminProductsLoading,
  selectAdminProductsMutating,
  selectAdminProductsPage,
  selectAdminProductsPageSize,
  selectAdminProductsSummary,
  selectAdminProductsTotalCount,
  selectProductModerationHistory,
} from '../store/adminSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type {
  AdminProductListQuery,
  AdminProductStatusFilter,
  RejectProductPayload,
} from '../types/admin';

function normalizeQuery(
  statusOrQuery: AdminProductStatusFilter | AdminProductListQuery,
): AdminProductListQuery {
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

export function useAdminProducts(
  statusOrQuery: AdminProductStatusFilter | AdminProductListQuery = 'Pending',
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectAdminProducts);
  const loadedFilter = useAppSelector(selectAdminProductsFilter);
  const page = useAppSelector(selectAdminProductsPage);
  const pageSize = useAppSelector(selectAdminProductsPageSize);
  const totalCount = useAppSelector(selectAdminProductsTotalCount);
  const summary = useAppSelector(selectAdminProductsSummary);
  const loading = useAppSelector(selectAdminProductsLoading);
  const mutating = useAppSelector(selectAdminProductsMutating);
  const error = useAppSelector(selectAdminProductsError);
  const loaded = useAppSelector(selectAdminProductsLoaded);
  const autoLoad = options?.autoLoad ?? true;
  const listQuery = normalizeQuery(statusOrQuery);

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchAdminProducts(listQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, dispatch, listQuery.status, listQuery.page, listQuery.pageSize, listQuery.q]);

  const reload = useCallback(
    (next?: AdminProductListQuery) => dispatch(fetchAdminProducts(next ?? listQuery)),
    [dispatch, listQuery.page, listQuery.pageSize, listQuery.q, listQuery.status],
  );

  const loadOne = useCallback(
    async (id: string) => {
      const result = await dispatch(fetchAdminProduct(id));
      if (fetchAdminProduct.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Product not found.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const loadHistory = useCallback(
    async (id: string) => {
      const result = await dispatch(fetchProductModerationHistory(id));
      if (fetchProductModerationHistory.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to load moderation history.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const approve = useCallback(
    async (id: string) => {
      const result = await dispatch(approveAdminProduct(id));
      if (approveAdminProduct.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to approve product.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const reject = useCallback(
    async (id: string, payload: RejectProductPayload) => {
      const result = await dispatch(rejectAdminProduct({ id, payload }));
      if (rejectAdminProduct.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to reject product.');
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
    loadHistory,
    approve,
    reject,
  };
}

export function useAdminProductDetail(id: string | undefined) {
  return useAppSelector(selectAdminProductDetailById(id ?? ''));
}

export function useProductModerationHistory(id: string | undefined) {
  return useAppSelector(selectProductModerationHistory(id ?? ''));
}
