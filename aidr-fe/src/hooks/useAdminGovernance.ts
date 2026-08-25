import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  clearAdminAccountDetail,
  fetchAdminAccount,
  fetchAdminAccounts,
  fetchAdminCustomerInsights,
  lockAdminAccount,
  selectAdminAccountDetailError,
  selectAdminAccountDetailLoading,
  selectAdminAccountPage,
  selectAdminAccountPageSize,
  selectAdminAccountSelected,
  selectAdminAccountSummary,
  selectAdminAccountTotalCount,
  selectAdminAccounts,
  selectAdminAccountsError,
  selectAdminAccountsLoading,
  selectAdminAccountsMutating,
  selectAdminCustomerInsights,
  selectAdminCustomerInsightsError,
  selectAdminCustomerInsightsLoading,
  unlockAdminAccount,
} from '../store/adminGovernanceSlice';
import type { AdminAccountListQuery, AdminCustomerInsightsQuery } from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export function useAdminAccounts(
  query?: AdminAccountListQuery,
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectAdminAccounts);
  const page = useAppSelector(selectAdminAccountPage);
  const pageSize = useAppSelector(selectAdminAccountPageSize);
  const totalCount = useAppSelector(selectAdminAccountTotalCount);
  const summary = useAppSelector(selectAdminAccountSummary);
  const loading = useAppSelector(selectAdminAccountsLoading);
  const mutating = useAppSelector(selectAdminAccountsMutating);
  const error = useAppSelector(selectAdminAccountsError);
  const autoLoad = options?.autoLoad ?? true;

  const listQuery: AdminAccountListQuery = {
    status: query?.status ?? 'all',
    role: query?.role ?? 'all',
    q: query?.q,
    page: query?.page ?? 1,
    pageSize: query?.pageSize ?? 10,
  };

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchAdminAccounts(listQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when list filters change
  }, [
    autoLoad,
    dispatch,
    listQuery.status,
    listQuery.role,
    listQuery.q,
    listQuery.page,
    listQuery.pageSize,
  ]);

  const reload = useCallback(
    (next?: AdminAccountListQuery) => dispatch(fetchAdminAccounts(next ?? listQuery)),
    [dispatch, listQuery],
  );

  const lock = useCallback(
    async (id: string) => {
      const result = await dispatch(lockAdminAccount(id));
      if (lockAdminAccount.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to lock account.',
        );
      }
      return result.payload;
    },
    [dispatch],
  );

  const unlock = useCallback(
    async (id: string) => {
      const result = await dispatch(unlockAdminAccount(id));
      if (unlockAdminAccount.rejected.match(result)) {
        throw new Error(
          typeof result.payload === 'string' ? result.payload : 'Unable to unlock account.',
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
    lock,
    unlock,
    getErrorMessage: getApiErrorMessage,
  };
}

export function useAdminAccountDetail(id: string | undefined) {
  const dispatch = useAppDispatch();
  const account = useAppSelector(selectAdminAccountSelected);
  const loading = useAppSelector(selectAdminAccountDetailLoading);
  const mutating = useAppSelector(selectAdminAccountsMutating);
  const error = useAppSelector(selectAdminAccountDetailError);

  useEffect(() => {
    if (!id) return;
    void dispatch(fetchAdminAccount(id));
    return () => {
      dispatch(clearAdminAccountDetail());
    };
  }, [dispatch, id]);

  const lock = useCallback(async () => {
    if (!id) throw new Error('Account id is required.');
    const result = await dispatch(lockAdminAccount(id));
    if (lockAdminAccount.rejected.match(result)) {
      throw new Error(
        typeof result.payload === 'string' ? result.payload : 'Unable to lock account.',
      );
    }
    return result.payload;
  }, [dispatch, id]);

  const unlock = useCallback(async () => {
    if (!id) throw new Error('Account id is required.');
    const result = await dispatch(unlockAdminAccount(id));
    if (unlockAdminAccount.rejected.match(result)) {
      throw new Error(
        typeof result.payload === 'string' ? result.payload : 'Unable to unlock account.',
      );
    }
    return result.payload;
  }, [dispatch, id]);

  const reload = useCallback(() => {
    if (!id) return;
    return dispatch(fetchAdminAccount(id));
  }, [dispatch, id]);

  return {
    account: account?.userId === id ? account : null,
    loading,
    mutating,
    error,
    lock,
    unlock,
    reload,
  };
}

export function useAdminCustomerInsights(
  query?: AdminCustomerInsightsQuery,
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const insights = useAppSelector(selectAdminCustomerInsights);
  const loading = useAppSelector(selectAdminCustomerInsightsLoading);
  const error = useAppSelector(selectAdminCustomerInsightsError);
  const autoLoad = options?.autoLoad ?? true;

  const insightsQuery: AdminCustomerInsightsQuery = {
    from: query?.from,
    to: query?.to,
    granularity: query?.granularity ?? 'day',
  };

  useEffect(() => {
    if (!autoLoad) return;
    void dispatch(fetchAdminCustomerInsights(insightsQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters change
  }, [autoLoad, dispatch, insightsQuery.from, insightsQuery.to, insightsQuery.granularity]);

  const reload = useCallback(
    (next?: AdminCustomerInsightsQuery) =>
      dispatch(fetchAdminCustomerInsights(next ?? insightsQuery)),
    [dispatch, insightsQuery],
  );

  return {
    insights,
    loading,
    error,
    reload,
    getErrorMessage: getApiErrorMessage,
  };
}
