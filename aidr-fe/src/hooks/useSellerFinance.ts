import { useCallback, useEffect, useMemo } from 'react';
import {
  fetchSellerDashboard,
  fetchSellerSalesReport,
  fetchSellerWallet,
  selectSellerDashboard,
  selectSellerDashboardError,
  selectSellerDashboardLoading,
  selectSellerSalesReport,
  selectSellerSalesReportError,
  selectSellerSalesReportLoading,
  selectSellerSalesReportMatchesQuery,
  selectSellerWallet,
  selectSellerWalletError,
  selectSellerWalletLoading,
  selectSellerWalletMatchesQuery,
} from '../store/sellerFinanceSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { SellerSalesReportQuery, SellerWalletQuery } from '../types/sellerFinance';

export function useSellerDashboard(options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const dashboard = useAppSelector(selectSellerDashboard);
  const loading = useAppSelector(selectSellerDashboardLoading);
  const error = useAppSelector(selectSellerDashboardError);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchSellerDashboard());
  }, [autoLoad, dispatch]);

  const refresh = useCallback(
    () => dispatch(fetchSellerDashboard()).unwrap(),
    [dispatch],
  );

  return { dashboard, loading, error, refresh };
}

export function useSellerSalesReport(
  query: SellerSalesReportQuery,
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const report = useAppSelector(selectSellerSalesReport);
  const loading = useAppSelector(selectSellerSalesReportLoading);
  const error = useAppSelector(selectSellerSalesReportError);
  const autoLoad = options?.autoLoad ?? true;

  const normalizedQuery = useMemo(
    () => ({
      from: query.from?.trim() || undefined,
      to: query.to?.trim() || undefined,
      granularity: query.granularity,
    }),
    [query.from, query.granularity, query.to],
  );

  const matches = useAppSelector((state) =>
    selectSellerSalesReportMatchesQuery(state, normalizedQuery),
  );

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchSellerSalesReport(normalizedQuery));
  }, [autoLoad, dispatch, normalizedQuery]);

  const refresh = useCallback(
    () => dispatch(fetchSellerSalesReport(normalizedQuery)).unwrap(),
    [dispatch, normalizedQuery],
  );

  return {
    report: matches ? report : null,
    loading,
    error,
    refresh,
  };
}

export function useSellerWallet(query: SellerWalletQuery, options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const wallet = useAppSelector(selectSellerWallet);
  const loading = useAppSelector(selectSellerWalletLoading);
  const error = useAppSelector(selectSellerWalletError);
  const autoLoad = options?.autoLoad ?? true;

  const normalizedQuery = useMemo(
    () => ({
      txType: query.txType?.trim() || null,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    }),
    [query.page, query.pageSize, query.txType],
  );

  const matches = useAppSelector((state) =>
    selectSellerWalletMatchesQuery(state, normalizedQuery),
  );

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchSellerWallet(normalizedQuery));
  }, [autoLoad, dispatch, normalizedQuery]);

  const refresh = useCallback(
    () => dispatch(fetchSellerWallet(normalizedQuery)).unwrap(),
    [dispatch, normalizedQuery],
  );

  return {
    wallet: matches ? wallet : null,
    loading,
    error,
    refresh,
  };
}
