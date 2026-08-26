import { useCallback } from 'react';
import {
  COMPARE_MAX,
  clearCompareResult,
  clearCompareSelection,
  parseNlFilter,
  removeCompareSelection,
  runCompare,
  selectCompareError,
  selectCompareLoading,
  selectCompareResult,
  selectCompareSelection,
  selectIsInCompare,
  selectLastNlResult,
  selectNlError,
  selectNlLoading,
  toggleCompareSelection,
} from '../store/aiSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { CompareSelectionItem } from '../types/ai';

export function useNlFilter() {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectNlLoading);
  const error = useAppSelector(selectNlError);
  const lastResult = useAppSelector(selectLastNlResult);

  const parse = useCallback(
    async (query: string) => {
      const action = await dispatch(parseNlFilter(query));
      if (parseNlFilter.fulfilled.match(action)) {
        return action.payload;
      }
      throw new Error(
        (action.payload as string) || action.error.message || 'Unable to convert your search into filters.',
      );
    },
    [dispatch],
  );

  return { loading, error, lastResult, parse };
}

export function useCompare() {
  const dispatch = useAppDispatch();
  const selection = useAppSelector(selectCompareSelection);
  const loading = useAppSelector(selectCompareLoading);
  const error = useAppSelector(selectCompareError);
  const result = useAppSelector(selectCompareResult);

  const isSelected = useCallback(
    (productId: string) => selection.some((x) => x.productId === productId),
    [selection],
  );

  const toggle = useCallback(
    (item: CompareSelectionItem) => {
      if (!isSelected(item.productId) && selection.length >= COMPARE_MAX) {
        return { ok: false as const, reason: 'full' as const };
      }
      dispatch(toggleCompareSelection(item));
      return { ok: true as const };
    },
    [dispatch, isSelected, selection.length],
  );

  const remove = useCallback(
    (productId: string) => {
      dispatch(removeCompareSelection(productId));
    },
    [dispatch],
  );

  const clear = useCallback(() => {
    dispatch(clearCompareSelection());
  }, [dispatch]);

  const clearResult = useCallback(() => {
    dispatch(clearCompareResult());
  }, [dispatch]);

  const compare = useCallback(
    async (productIds?: string[]) => {
      const ids = productIds ?? selection.map((x) => x.productId);
      const action = await dispatch(runCompare(ids));
      if (runCompare.fulfilled.match(action)) {
        return action.payload;
      }
      throw new Error((action.payload as string) || action.error.message || 'Unable to compare products.');
    },
    [dispatch, selection],
  );

  return {
    selection,
    loading,
    error,
    result,
    isSelected,
    toggle,
    remove,
    clear,
    clearResult,
    compare,
    max: COMPARE_MAX,
  };
}

export function useCompareSelected(productId: string) {
  return useAppSelector(selectIsInCompare(productId));
}
