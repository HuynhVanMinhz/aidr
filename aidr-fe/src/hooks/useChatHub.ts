import { useEffect, useRef } from 'react';
import { selectAccessToken, selectAuth, selectIsAuthenticated } from '../store/authSlice';
import {
  chatMessageReceived,
  chatThreadReadReceived,
  chatTypingCleared,
  chatTypingReceived,
  fetchChatThreads,
  selectChatThreads,
} from '../store/chatSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { startChatHub, stopChatHub } from '../realtime/chatHub';
import type { ChatMessage, ChatThreadReadEvent, ChatTypingEvent } from '../types/chat';

/** Drop a stale "is typing" indicator if the sender never sends the stop signal. */
const TYPING_TIMEOUT_MS = 6000;

/**
 * Keeps ChatHub connected while authenticated. The server delivers chat events to per-user
 * groups, so every conversation stays live no matter which one is currently open.
 */
export function useChatHub() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const accessToken = useAppSelector(selectAccessToken);
  const userId = useAppSelector(selectAuth).user?.userId ?? null;
  const threads = useAppSelector(selectChatThreads);

  const tokenRef = useRef(accessToken);
  const userIdRef = useRef(userId);
  const knownThreadIdsRef = useRef<Set<string>>(new Set());
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  tokenRef.current = accessToken;
  userIdRef.current = userId;
  knownThreadIdsRef.current = new Set(threads.map((thread) => thread.threadId));

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      void stopChatHub();
      return;
    }

    let cancelled = false;
    const typingTimers = typingTimersRef.current;

    const handleMessage = (message: ChatMessage) => {
      if (cancelled) return;
      dispatch(chatMessageReceived({ message, currentUserId: userIdRef.current }));

      // A message on a thread we have never listed (e.g. a buyer's first message to a shop)
      // would otherwise be invisible until a manual refresh.
      if (!knownThreadIdsRef.current.has(message.threadId)) {
        knownThreadIdsRef.current.add(message.threadId);
        void dispatch(fetchChatThreads({ page: 1, pageSize: 50 }));
      }
    };

    const handleThreadRead = (event: ChatThreadReadEvent) => {
      if (cancelled) return;
      dispatch(chatThreadReadReceived({ event, currentUserId: userIdRef.current }));
    };

    const handleTyping = (event: ChatTypingEvent) => {
      if (cancelled) return;
      dispatch(chatTypingReceived(event));

      clearTimeout(typingTimers[event.threadId]);
      delete typingTimers[event.threadId];

      if (event.isTyping) {
        typingTimers[event.threadId] = setTimeout(() => {
          delete typingTimers[event.threadId];
          dispatch(chatTypingCleared(event.threadId));
        }, TYPING_TIMEOUT_MS);
      }
    };

    void (async () => {
      try {
        await startChatHub(() => tokenRef.current, {
          onMessage: handleMessage,
          onThreadRead: handleThreadRead,
          onTyping: handleTyping,
        });
      } catch {
        // Hub is best-effort; REST chat still works.
      }
    })();

    return () => {
      cancelled = true;
      Object.values(typingTimers).forEach(clearTimeout);
      Object.keys(typingTimers).forEach((key) => delete typingTimers[key]);
      void stopChatHub();
    };
  }, [accessToken, dispatch, isAuthenticated]);
}
