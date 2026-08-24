import { useCallback, useEffect } from 'react';
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  fetchAdminCategory,
  fetchAdminCategoryOptions,
  selectAdminCategories,
  selectAdminCategoriesLoaded,
  selectAdminCategoriesLoading,
  selectAdminCategoryOptions,
  selectAdminCategoryPage,
  selectAdminCategoryPageSize,
  selectAdminCategorySummary,
  selectAdminCategoryTotalCount,
  selectAdminError,
  selectAdminMutating,
  updateAdminCategory,
  updateAdminCategoryStatus,
} from '../store/adminSlice';
import { invalidateCategories } from '../store/catalogSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { AdminCategoryListQuery, CreateCategoryPayload, UpdateCategoryPayload } from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export function useAdminCategories(
  query?: AdminCategoryListQuery,
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const categories = useAppSelector(selectAdminCategories);
  const categoryOptions = useAppSelector(selectAdminCategoryOptions);
  const page = useAppSelector(selectAdminCategoryPage);
  const pageSize = useAppSelector(selectAdminCategoryPageSize);
  const totalCount = useAppSelector(selectAdminCategoryTotalCount);
  const summary = useAppSelector(selectAdminCategorySummary);
  const loading = useAppSelector(selectAdminCategoriesLoading);
  const mutating = useAppSelector(selectAdminMutating);
  const error = useAppSelector(selectAdminError);
  const loaded = useAppSelector(selectAdminCategoriesLoaded);
  const autoLoad = options?.autoLoad ?? true;

  const listQuery: AdminCategoryListQuery = {
    q: query?.q ?? '',
    page: query?.page ?? 1,
    pageSize: query?.pageSize ?? 10,
  };

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchAdminCategories(listQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when list query changes
  }, [autoLoad, dispatch, listQuery.q, listQuery.page, listQuery.pageSize]);

  const reload = useCallback(
    (next?: AdminCategoryListQuery) => dispatch(fetchAdminCategories(next ?? listQuery)),
    [dispatch, listQuery.page, listQuery.pageSize, listQuery.q],
  );

  const loadOptions = useCallback(() => dispatch(fetchAdminCategoryOptions()), [dispatch]);

  const invalidatePublicTree = useCallback(() => {
    dispatch(invalidateCategories());
  }, [dispatch]);

  const create = useCallback(
    async (payload: CreateCategoryPayload) => {
      const result = await dispatch(createAdminCategory(payload));
      if (createAdminCategory.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to create category.');
      }
      invalidatePublicTree();
      return result.payload;
    },
    [dispatch, invalidatePublicTree],
  );

  const update = useCallback(
    async (id: number, payload: UpdateCategoryPayload) => {
      const result = await dispatch(updateAdminCategory({ id, payload }));
      if (updateAdminCategory.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to update category.');
      }
      invalidatePublicTree();
      return result.payload;
    },
    [dispatch, invalidatePublicTree],
  );

  const setStatus = useCallback(
    async (id: number, isActive: boolean) => {
      const result = await dispatch(updateAdminCategoryStatus({ id, isActive }));
      if (updateAdminCategoryStatus.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to update category status.');
      }
      invalidatePublicTree();
      return result.payload;
    },
    [dispatch, invalidatePublicTree],
  );

  const remove = useCallback(
    async (id: number) => {
      const result = await dispatch(deleteAdminCategory(id));
      if (deleteAdminCategory.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to delete category.');
      }
      invalidatePublicTree();
    },
    [dispatch, invalidatePublicTree],
  );

  const loadOne = useCallback(
    async (id: number) => {
      const result = await dispatch(fetchAdminCategory(id));
      if (fetchAdminCategory.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Category not found.');
      }
      return result.payload;
    },
    [dispatch],
  );

  return {
    categories,
    categoryOptions,
    page,
    pageSize,
    totalCount,
    summary,
    loading,
    mutating,
    error,
    loaded,
    reload,
    loadOptions,
    create,
    update,
    setStatus,
    remove,
    loadOne,
    getErrorMessage: getApiErrorMessage,
  };
}
