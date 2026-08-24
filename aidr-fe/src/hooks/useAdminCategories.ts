import { useCallback, useEffect } from 'react';
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  fetchAdminCategory,
  selectAdminCategories,
  selectAdminCategoriesLoaded,
  selectAdminCategoriesLoading,
  selectAdminError,
  selectAdminMutating,
  updateAdminCategory,
  updateAdminCategoryStatus,
} from '../store/adminSlice';
import { invalidateCategories } from '../store/catalogSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { CreateCategoryPayload, UpdateCategoryPayload } from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export function useAdminCategories(options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const categories = useAppSelector(selectAdminCategories);
  const loading = useAppSelector(selectAdminCategoriesLoading);
  const mutating = useAppSelector(selectAdminMutating);
  const error = useAppSelector(selectAdminError);
  const loaded = useAppSelector(selectAdminCategoriesLoaded);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (autoLoad && !loaded && !loading) {
      void dispatch(fetchAdminCategories());
    }
  }, [autoLoad, dispatch, loaded, loading]);

  const reload = useCallback(() => dispatch(fetchAdminCategories()), [dispatch]);

  const invalidatePublicTree = useCallback(() => {
    dispatch(invalidateCategories());
  }, [dispatch]);

  const create = useCallback(
    async (payload: CreateCategoryPayload) => {
      const result = await dispatch(createAdminCategory(payload));
      if (createAdminCategory.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Không tạo được danh mục.');
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
        throw new Error((result.payload as string) || 'Không cập nhật được danh mục.');
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
        throw new Error((result.payload as string) || 'Không đổi trạng thái danh mục.');
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
        throw new Error((result.payload as string) || 'Không xóa được danh mục.');
      }
      invalidatePublicTree();
    },
    [dispatch, invalidatePublicTree],
  );

  const loadOne = useCallback(
    async (id: number) => {
      const result = await dispatch(fetchAdminCategory(id));
      if (fetchAdminCategory.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Không tìm thấy danh mục.');
      }
      return result.payload;
    },
    [dispatch],
  );

  return {
    categories,
    loading,
    mutating,
    error,
    loaded,
    reload,
    create,
    update,
    setStatus,
    remove,
    loadOne,
    getErrorMessage: getApiErrorMessage,
  };
}
