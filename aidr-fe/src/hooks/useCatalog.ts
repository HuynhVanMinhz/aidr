import { useCallback, useEffect } from 'react';
import {
  clearSelectedProduct,
  defaultCatalogFilters,
  fetchCategories,
  fetchProductDetail,
  fetchProducts,
  replaceFilters,
  selectCatalogFilters,
  selectCatalogListError,
  selectCatalogListLoading,
  selectCatalogPaging,
  selectCatalogProducts,
  selectCategories,
  selectCategoriesError,
  selectCategoriesLoaded,
  selectCategoriesLoading,
  selectDetailError,
  selectDetailLoading,
  selectSelectedProduct,
  setFilters,
  type CatalogFilters,
} from '../store/catalogSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getApiErrorMessage } from '../utils/apiError';

export function useCatalogList(options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectCatalogFilters);
  const products = useAppSelector(selectCatalogProducts);
  const loading = useAppSelector(selectCatalogListLoading);
  const error = useAppSelector(selectCatalogListError);
  const paging = useAppSelector(selectCatalogPaging);
  const autoLoad = options?.autoLoad ?? true;

  const load = useCallback(
    (next?: Partial<CatalogFilters>) => {
      const merged = { ...filters, ...next };
      return dispatch(fetchProducts(merged));
    },
    [dispatch, filters],
  );

  const applyFilters = useCallback(
    (next: CatalogFilters) => dispatch(fetchProducts(next)),
    [dispatch],
  );

  const patchFilters = useCallback(
    (patch: Partial<CatalogFilters>) => {
      dispatch(setFilters(patch));
    },
    [dispatch],
  );

  useEffect(() => {
    if (autoLoad) {
      void dispatch(fetchProducts(filters));
    }
    // auto-load only on mount from initial URL filters (page calls apply itself)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, dispatch]);

  return {
    filters,
    products,
    loading,
    error,
    paging,
    load,
    applyFilters,
    patchFilters,
    replaceFilters: (next: CatalogFilters) => dispatch(replaceFilters(next)),
    defaultFilters: defaultCatalogFilters,
    getErrorMessage: getApiErrorMessage,
  };
}

export function useCategories(options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const categories = useAppSelector(selectCategories);
  const loading = useAppSelector(selectCategoriesLoading);
  const error = useAppSelector(selectCategoriesError);
  const loaded = useAppSelector(selectCategoriesLoaded);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (autoLoad && !loaded && !loading) {
      void dispatch(fetchCategories());
    }
  }, [autoLoad, dispatch, loaded, loading]);

  const reload = useCallback(() => dispatch(fetchCategories()), [dispatch]);

  return { categories, loading, error, loaded, reload, getErrorMessage: getApiErrorMessage };
}

export function useProductDetail(productId: string | undefined) {
  const dispatch = useAppDispatch();
  const product = useAppSelector(selectSelectedProduct);
  const loading = useAppSelector(selectDetailLoading);
  const error = useAppSelector(selectDetailError);

  useEffect(() => {
    if (!productId) return;
    void dispatch(fetchProductDetail(productId));
    return () => {
      dispatch(clearSelectedProduct());
    };
  }, [dispatch, productId]);

  return { product, loading, error, getErrorMessage: getApiErrorMessage };
}
