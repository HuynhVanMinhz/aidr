import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as notificationApi from '../services/notificationApi';
import type {
  DeleteNotificationResponse,
  MarkAllNotificationsReadResponse,
  NotificationItem,
  NotificationListQuery,
  NotificationListResult,
  NotificationUnreadCount,
} from '../types/notification';
import { getApiErrorMessage } from '../utils/apiError';

export type NotificationState = {
  items: NotificationItem[];
  previewItems: NotificationItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  unreadCount: number;
  unreadOnly: boolean;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
  unreadLoaded: boolean;
};

type NotificationRoot = { notifications: NotificationState };

const initialState: NotificationState = {
  items: [],
  previewItems: [],
  page: 1,
  pageSize: 20,
  totalCount: 0,
  totalPages: 0,
  unreadCount: 0,
  unreadOnly: false,
  loading: false,
  mutating: false,
  error: null,
  loaded: false,
  unreadLoaded: false,
};

function requireData<T>(
  result: { success: boolean; data?: T | null; message?: string | null },
  fallback: string,
): T {
  if (!result.success || result.data == null) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

function applyList(state: NotificationState, list: NotificationListResult, unreadOnly: boolean) {
  state.items = list.items ?? [];
  state.page = list.page;
  state.pageSize = list.pageSize;
  state.totalCount = list.totalCount;
  state.totalPages = list.totalPages;
  state.unreadOnly = unreadOnly;
  state.loaded = true;
  state.error = null;
  if (state.page === 1) {
    state.previewItems = (list.items ?? []).slice(0, 8);
  }
}

function upsertPreview(state: NotificationState, item: NotificationItem) {
  const without = state.previewItems.filter((row) => row.notificationId !== item.notificationId);
  state.previewItems = [item, ...without].slice(0, 8);
}

export const fetchNotifications = createAsyncThunk<
  { list: NotificationListResult; unreadOnly: boolean },
  NotificationListQuery | undefined,
  { rejectValue: string }
>('notifications/fetch', async (query, { rejectWithValue }) => {
  try {
    const unreadOnly = query?.unreadOnly === true;
    const result = await notificationApi.getNotifications(query);
    return {
      list: requireData(result, 'Unable to load notifications.'),
      unreadOnly,
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load notifications.'));
  }
});

export const fetchUnreadNotificationCount = createAsyncThunk<
  NotificationUnreadCount,
  void,
  { rejectValue: string }
>('notifications/fetchUnreadCount', async (_, { rejectWithValue }) => {
  try {
    const result = await notificationApi.getUnreadNotificationCount();
    return requireData(result, 'Unable to load unread count.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load unread count.'));
  }
});

export const markNotificationRead = createAsyncThunk<
  NotificationItem,
  string,
  { rejectValue: string }
>('notifications/markRead', async (notificationId, { rejectWithValue }) => {
  try {
    const result = await notificationApi.markNotificationRead(notificationId);
    return requireData(result, 'Unable to mark notification as read.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to mark notification as read.'));
  }
});

export const markAllNotificationsRead = createAsyncThunk<
  MarkAllNotificationsReadResponse,
  void,
  { rejectValue: string }
>('notifications/markAllRead', async (_, { rejectWithValue }) => {
  try {
    const result = await notificationApi.markAllNotificationsRead();
    return requireData(result, 'Unable to mark all notifications as read.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to mark all notifications as read.'));
  }
});

export const deleteNotification = createAsyncThunk<
  DeleteNotificationResponse,
  string,
  { rejectValue: string }
>('notifications/delete', async (notificationId, { rejectWithValue }) => {
  try {
    const result = await notificationApi.deleteNotification(notificationId);
    return requireData(result, 'Unable to delete notification.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to delete notification.'));
  }
});

export const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotificationsState() {
      return { ...initialState };
    },
    notificationReceived(state, action: PayloadAction<NotificationItem>) {
      const incoming = action.payload;
      const existingIndex = state.items.findIndex(
        (item) => item.notificationId === incoming.notificationId,
      );

      if (existingIndex >= 0) {
        state.items[existingIndex] = incoming;
      } else if (state.page === 1 && (!state.unreadOnly || !incoming.isRead)) {
        state.items = [incoming, ...state.items].slice(0, state.pageSize);
        state.totalCount += 1;
      }

      upsertPreview(state, incoming);

      if (!incoming.isRead) {
        state.unreadCount += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        applyList(state, action.payload.list, action.payload.unreadOnly);
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to load notifications.';
      })
      .addCase(fetchUnreadNotificationCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.unreadCount;
        state.unreadLoaded = true;
      })
      .addCase(fetchUnreadNotificationCount.rejected, (state) => {
        state.unreadLoaded = true;
      })
      .addCase(markNotificationRead.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        state.mutating = false;
        const updated = action.payload;
        const wasUnread =
          state.items.some((item) => item.notificationId === updated.notificationId && !item.isRead) ||
          state.previewItems.some(
            (item) => item.notificationId === updated.notificationId && !item.isRead,
          );

        state.items = state.items.map((item) =>
          item.notificationId === updated.notificationId ? updated : item,
        );
        state.previewItems = state.previewItems.map((item) =>
          item.notificationId === updated.notificationId ? updated : item,
        );

        if (wasUnread) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }

        if (state.unreadOnly) {
          state.items = state.items.filter((item) => !item.isRead);
          state.totalCount = Math.max(0, state.totalCount - 1);
        }
      })
      .addCase(markNotificationRead.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to mark notification as read.';
      })
      .addCase(markAllNotificationsRead.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.mutating = false;
        state.unreadCount = 0;
        state.items = state.items.map((item) => ({ ...item, isRead: true }));
        state.previewItems = state.previewItems.map((item) => ({ ...item, isRead: true }));
        if (state.unreadOnly) {
          state.items = [];
          state.totalCount = 0;
        }
      })
      .addCase(markAllNotificationsRead.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to mark all notifications as read.';
      })
      .addCase(deleteNotification.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.mutating = false;
        const id = action.payload.notificationId;
        const removed =
          state.items.find((item) => item.notificationId === id) ??
          state.previewItems.find((item) => item.notificationId === id);

        state.items = state.items.filter((item) => item.notificationId !== id);
        state.previewItems = state.previewItems.filter((item) => item.notificationId !== id);
        state.totalCount = Math.max(0, state.totalCount - 1);

        if (removed && !removed.isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(deleteNotification.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? 'Unable to delete notification.';
      });
  },
});

export const { clearNotificationsState, notificationReceived } = notificationSlice.actions;

export const selectNotifications = (state: NotificationRoot) => state.notifications;
export const selectNotificationItems = (state: NotificationRoot) => state.notifications.items;
export const selectNotificationPreview = (state: NotificationRoot) =>
  state.notifications.previewItems;
export const selectUnreadNotificationCount = (state: NotificationRoot) =>
  state.notifications.unreadCount;
export const selectNotificationsLoading = (state: NotificationRoot) => state.notifications.loading;
export const selectNotificationsMutating = (state: NotificationRoot) =>
  state.notifications.mutating;
export const selectNotificationsError = (state: NotificationRoot) => state.notifications.error;
