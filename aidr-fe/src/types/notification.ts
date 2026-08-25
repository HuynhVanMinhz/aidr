import type { ApiResult } from './auth';
import type { PagedResult } from './catalog';

export type NotificationItem = {
  notificationId: string;
  title: string;
  body: string;
  type: string;
  referenceType?: string | null;
  referenceId?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationUnreadCount = {
  unreadCount: number;
};

export type MarkAllNotificationsReadResponse = {
  updatedCount: number;
};

export type DeleteNotificationResponse = {
  notificationId: string;
};

export type NotificationListQuery = {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean | null;
};

export type NotificationListResult = PagedResult<NotificationItem>;

export type NotificationListApiResult = ApiResult<NotificationListResult>;
export type NotificationItemApiResult = ApiResult<NotificationItem>;
export type NotificationUnreadCountApiResult = ApiResult<NotificationUnreadCount>;
export type MarkAllNotificationsReadApiResult = ApiResult<MarkAllNotificationsReadResponse>;
export type DeleteNotificationApiResult = ApiResult<DeleteNotificationResponse>;
