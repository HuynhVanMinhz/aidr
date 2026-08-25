import { useCallback, useEffect, useMemo } from 'react';
import { selectIsAuthenticated } from '../store/authSlice';
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  selectNotifications,
} from '../store/notificationSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { NotificationListQuery } from '../types/notification';
import { getApiErrorMessage } from '../utils/apiError';

export function useNotifications(
  query?: NotificationListQuery,
  options?: { autoLoad?: boolean },
) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const notifications = useAppSelector(selectNotifications);
  const autoLoad = options?.autoLoad ?? false;

  const normalizedQuery = useMemo(
    () => ({
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      unreadOnly: query?.unreadOnly === true ? true : null,
    }),
    [query?.page, query?.pageSize, query?.unreadOnly],
  );

  useEffect(() => {
    if (!autoLoad || !isAuthenticated) return;
    void dispatch(fetchNotifications(normalizedQuery));
  }, [autoLoad, dispatch, isAuthenticated, normalizedQuery]);

  const refresh = useCallback(
    () => dispatch(fetchNotifications(normalizedQuery)).unwrap(),
    [dispatch, normalizedQuery],
  );

  const markRead = useCallback(
    async (notificationId: string) => {
      const result = await dispatch(markNotificationRead(notificationId));
      if (markNotificationRead.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to mark notification as read.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const markAllRead = useCallback(async () => {
    const result = await dispatch(markAllNotificationsRead());
    if (markAllNotificationsRead.rejected.match(result)) {
      throw new Error(result.payload || 'Unable to mark all notifications as read.');
    }
    return result.payload;
  }, [dispatch]);

  const remove = useCallback(
    async (notificationId: string) => {
      const result = await dispatch(deleteNotification(notificationId));
      if (deleteNotification.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to delete notification.');
      }
      return result.payload;
    },
    [dispatch],
  );

  return {
    ...notifications,
    isAuthenticated,
    refresh,
    markRead,
    markAllRead,
    remove,
    getErrorMessage: getApiErrorMessage,
  };
}

export function useUnreadNotifications(options?: { autoLoad?: boolean }) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const notifications = useAppSelector(selectNotifications);
  const autoLoad = options?.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad || !isAuthenticated || notifications.unreadLoaded) return;
    void dispatch(fetchUnreadNotificationCount());
  }, [autoLoad, dispatch, isAuthenticated, notifications.unreadLoaded]);

  useEffect(() => {
    if (!autoLoad || !isAuthenticated || notifications.loaded) return;
    void dispatch(fetchNotifications({ page: 1, pageSize: 8 }));
  }, [autoLoad, dispatch, isAuthenticated, notifications.loaded]);

  return {
    unreadCount: notifications.unreadCount,
    previewItems: notifications.previewItems,
    unreadLoaded: notifications.unreadLoaded,
    isAuthenticated,
  };
}
