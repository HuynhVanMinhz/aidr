import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { selectAccessToken, selectIsAuthenticated } from '../store/authSlice';
import { notificationReceived } from '../store/notificationSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { removeNotificationHandler, startNotificationHub, stopNotificationHub } from '../realtime/signalr';
import type { NotificationItem } from '../types/notification';

const RETRY_MS = 4000;

/**
 * Keeps SignalR NotificationHub connected while the user is authenticated.
 * Incoming events prepend the inbox and bump unread count.
 * Retries when the API/proxy is temporarily unavailable (ECONNREFUSED).
 */
export function useNotificationHub() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const accessToken = useAppSelector(selectAccessToken);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      void stopNotificationHub();
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (notification: NotificationItem) => {
      if (cancelled) return;
      dispatch(notificationReceived(notification));
      toast.message(notification.title, {
        description: notification.body,
      });
    };

    const connect = async () => {
      if (cancelled) return;
      try {
        await startNotificationHub(() => tokenRef.current, handler);
      } catch {
        // Hub is best-effort; REST inbox still works. Retry when API comes back.
        removeNotificationHandler(handler);
        if (!cancelled) {
          retryTimer = setTimeout(() => {
            void connect();
          }, RETRY_MS);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      // Remove only our handler; other subscribers (e.g. return detail page) stay alive.
      void stopNotificationHub(handler);
    };
  }, [accessToken, dispatch, isAuthenticated]);
}
