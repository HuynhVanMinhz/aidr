import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { selectAccessToken, selectIsAuthenticated } from '../store/authSlice';
import { notificationReceived } from '../store/notificationSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { startNotificationHub, stopNotificationHub } from '../realtime/signalr';
import type { NotificationItem } from '../types/notification';

/**
 * Keeps SignalR NotificationHub connected while the user is authenticated.
 * Incoming events prepend the inbox and bump unread count.
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

    void (async () => {
      try {
        await startNotificationHub(
          () => tokenRef.current,
          (notification: NotificationItem) => {
            if (cancelled) return;
            dispatch(notificationReceived(notification));
            toast.message(notification.title, {
              description: notification.body,
            });
          },
        );
      } catch {
        // Hub is best-effort; REST inbox still works offline.
      }
    })();

    return () => {
      cancelled = true;
      void stopNotificationHub();
    };
  }, [accessToken, dispatch, isAuthenticated]);
}
