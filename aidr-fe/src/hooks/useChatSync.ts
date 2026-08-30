import { useCallback, useEffect, useRef } from 'react';
import { isChatHubConnected } from '../realtime/chatHub';
import { selectNotificationPreview } from '../store/notificationSlice';
import { useAppSelector } from '../store/hooks';

/** How often to re-check the server while the realtime hub is not connected. */
const OFFLINE_POLL_MS = 15_000;
/** Floor between two syncs, so focus + notification + poll cannot stampede the API. */
const MIN_SYNC_GAP_MS = 2_000;

type ChatLiveSyncOptions = {
  activeThreadId: string | null;
  refreshThreads: () => Promise<unknown>;
  syncActiveThread: () => Promise<unknown>;
};

/**
 * Safety net around the SignalR hub. The chat UI must never sit on stale content just because a
 * push was missed — a dropped connection, a proxy timeout, or a backend/frontend version skew.
 * Re-syncs when the tab regains focus, when a chat notification lands, and on a slow poll while
 * the hub is down. All of these merge into the store, so scroll position and loaded history stay.
 */
export function useChatLiveSync({
  activeThreadId,
  refreshThreads,
  syncActiveThread,
}: ChatLiveSyncOptions) {
  const previewItems = useAppSelector(selectNotificationPreview);
  const lastSyncAtRef = useRef(0);
  const lastChatNotificationRef = useRef<string | null>(null);

  const sync = useCallback(
    (force = false) => {
      const now = Date.now();
      if (!force && now - lastSyncAtRef.current < MIN_SYNC_GAP_MS) return;
      lastSyncAtRef.current = now;

      void refreshThreads().catch(() => {});
      void syncActiveThread().catch(() => {});
    },
    [refreshThreads, syncActiveThread],
  );

  // A chat notification proves the message exists even when the chat hub missed the push.
  const newestChatId =
    previewItems.find((item) => item.type?.toLowerCase() === 'chat')?.notificationId ?? null;

  useEffect(() => {
    if (!newestChatId || newestChatId === lastChatNotificationRef.current) return;
    lastChatNotificationRef.current = newestChatId;

    // Deliberately syncs on the initial inbox load too: telling "first hydration" apart from a
    // live push needs state that is itself racy, and one extra merge on mount costs nothing.
    sync(true);
  }, [newestChatId, sync]);

  useEffect(() => {
    function onFocus() {
      sync();
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') sync();
    }

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sync]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isChatHubConnected()) return;
      if (document.visibilityState === 'hidden') return;
      sync(true);
    }, OFFLINE_POLL_MS);

    return () => clearInterval(timer);
  }, [sync]);

  // Opening a different conversation is a good moment to reconcile the list too.
  useEffect(() => {
    if (!activeThreadId) return;
    lastSyncAtRef.current = Date.now();
  }, [activeThreadId]);
}
