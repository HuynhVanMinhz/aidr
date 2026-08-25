import type {
  DeleteNotificationApiResult,
  MarkAllNotificationsReadApiResult,
  NotificationItemApiResult,
  NotificationListApiResult,
  NotificationListQuery,
  NotificationUnreadCountApiResult,
} from '../types/notification';
import { apiClient } from './apiClient';

export async function getNotifications(query?: NotificationListQuery) {
  const { data } = await apiClient.get<NotificationListApiResult>('/notifications', {
    params: {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      unreadOnly: query?.unreadOnly === true ? true : undefined,
    },
  });
  return data;
}

export async function getUnreadNotificationCount() {
  const { data } = await apiClient.get<NotificationUnreadCountApiResult>(
    '/notifications/unread-count',
  );
  return data;
}

export async function markNotificationRead(notificationId: string) {
  const { data } = await apiClient.post<NotificationItemApiResult>(
    `/notifications/${notificationId}/read`,
  );
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await apiClient.post<MarkAllNotificationsReadApiResult>(
    '/notifications/read-all',
  );
  return data;
}

export async function deleteNotification(notificationId: string) {
  const { data } = await apiClient.delete<DeleteNotificationApiResult>(
    `/notifications/${notificationId}`,
  );
  return data;
}
