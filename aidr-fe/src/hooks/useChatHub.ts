import { useEffect, useRef } from 'react';
import { selectAccessToken, selectAuth, selectIsAuthenticated } from '../store/authSlice';
import { chatMessageReceived } from '../store/chatSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  joinChatThread,
  leaveChatThread,
  startChatHub,
  stopChatHub,
} from '../realtime/chatHub';
import type { ChatMessage } from '../types/chat';

/**
 * Keeps ChatHub connected while authenticated and joins the active thread group.
 */
export function useChatHub(activeThreadId: string | null) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const accessToken = useAppSelector(selectAccessToken);
  const userId = useAppSelector(selectAuth).user?.userId ?? null;
  const tokenRef = useRef(accessToken);
  const userIdRef = useRef(userId);
  tokenRef.current = accessToken;
  userIdRef.current = userId;

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      void stopChatHub();
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await startChatHub(
          () => tokenRef.current,
          (message: ChatMessage) => {
            if (cancelled) return;
            dispatch(
              chatMessageReceived({
                message,
                currentUserId: userIdRef.current,
              }),
            );
          },
        );
      } catch {
        // Hub is best-effort; REST chat still works.
      }
    })();

    return () => {
      cancelled = true;
      void stopChatHub();
    };
  }, [accessToken, dispatch, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !activeThreadId) {
      void leaveChatThread();
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await joinChatThread(activeThreadId);
      } catch {
        if (!cancelled) {
          // ignore join failures
        }
      }
    })();

    return () => {
      cancelled = true;
      void leaveChatThread(activeThreadId);
    };
  }, [accessToken, activeThreadId, isAuthenticated]);
}
