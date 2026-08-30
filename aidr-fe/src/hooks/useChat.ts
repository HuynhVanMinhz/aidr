import { useCallback, useEffect, useMemo, useRef } from 'react';
import { selectAuth, selectIsAuthenticated } from '../store/authSlice';
import {
  fetchChatMessages,
  fetchChatThreads,
  fetchOlderChatMessages,
  markChatThreadRead,
  openChatThread,
  selectChat,
  sendChatMessage,
  setActiveThreadId,
  syncChatMessages,
} from '../store/chatSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { sendTypingSignal } from '../realtime/chatHub';
import type { OpenChatThreadRequest, SendChatMessageRequest } from '../types/chat';
import { getApiErrorMessage } from '../utils/apiError';

const MESSAGE_PAGE_SIZE = 30;
/** Re-send "still typing" at most this often while the composer stays busy. */
const TYPING_PING_MS = 3000;

export function useChat(options?: { autoLoadThreads?: boolean }) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const currentUserId = useAppSelector(selectAuth).user?.userId ?? null;
  const chat = useAppSelector(selectChat);
  const autoLoadThreads = options?.autoLoadThreads ?? true;
  const lastTypingSentAtRef = useRef(0);
  const typingActiveRef = useRef(false);

  useEffect(() => {
    if (!autoLoadThreads || !isAuthenticated) return;
    void dispatch(fetchChatThreads({ page: 1, pageSize: 50 }));
  }, [autoLoadThreads, dispatch, isAuthenticated]);

  const activeThread = useMemo(
    () => chat.threads.find((t) => t.threadId === chat.activeThreadId) ?? null,
    [chat.activeThreadId, chat.threads],
  );

  const totalUnread = useMemo(
    () => chat.threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0),
    [chat.threads],
  );

  const hasOlderMessages = chat.messageTotalCount > chat.messages.length;

  const typingPeerUserId = chat.activeThreadId
    ? chat.typingByThread[chat.activeThreadId] ?? null
    : null;
  const peerIsTyping = Boolean(typingPeerUserId && typingPeerUserId !== currentUserId);

  const refreshThreads = useCallback(
    () => dispatch(fetchChatThreads({ page: 1, pageSize: 50 })).unwrap(),
    [dispatch],
  );

  const markRead = useCallback(
    (threadId: string) => dispatch(markChatThreadRead(threadId)).unwrap(),
    [dispatch],
  );

  const selectThread = useCallback(
    async (threadId: string) => {
      dispatch(setActiveThreadId(threadId));
      await dispatch(
        fetchChatMessages({ threadId, page: 1, pageSize: MESSAGE_PAGE_SIZE }),
      ).unwrap();
      await dispatch(markChatThreadRead(threadId)).unwrap();
    },
    [dispatch],
  );

  const openThread = useCallback(
    async (body: OpenChatThreadRequest) => {
      const thread = await dispatch(openChatThread(body)).unwrap();
      await dispatch(
        fetchChatMessages({ threadId: thread.threadId, page: 1, pageSize: MESSAGE_PAGE_SIZE }),
      ).unwrap();
      await dispatch(markChatThreadRead(thread.threadId)).unwrap();
      return thread;
    },
    [dispatch],
  );

  const loadOlderMessages = useCallback(async () => {
    if (!chat.activeThreadId || chat.loadingOlderMessages || !hasOlderMessages) return;
    await dispatch(
      fetchOlderChatMessages({
        threadId: chat.activeThreadId,
        page: chat.messagePage + 1,
        pageSize: chat.messagePageSize || MESSAGE_PAGE_SIZE,
      }),
    ).unwrap();
  }, [
    chat.activeThreadId,
    chat.loadingOlderMessages,
    chat.messagePage,
    chat.messagePageSize,
    dispatch,
    hasOlderMessages,
  ]);

  /** Pull the newest page and merge it in — used by the focus / polling fallbacks. */
  const syncActiveThread = useCallback(async () => {
    if (!chat.activeThreadId) return;
    await dispatch(
      syncChatMessages({
        threadId: chat.activeThreadId,
        pageSize: chat.messagePageSize || MESSAGE_PAGE_SIZE,
      }),
    );
  }, [chat.activeThreadId, chat.messagePageSize, dispatch]);

  const send = useCallback(
    async (threadId: string, body: SendChatMessageRequest) => {
      const result = await dispatch(sendChatMessage({ threadId, body }));
      if (sendChatMessage.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to send message.');
      }

      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        void sendTypingSignal(threadId, false);
      }

      return result.payload;
    },
    [dispatch],
  );

  /** Throttled so a fast typist does not flood the hub with one invoke per keystroke. */
  const notifyTyping = useCallback((threadId: string, isTyping: boolean) => {
    if (!threadId) return;

    if (!isTyping) {
      if (!typingActiveRef.current) return;
      typingActiveRef.current = false;
      lastTypingSentAtRef.current = 0;
      void sendTypingSignal(threadId, false);
      return;
    }

    const now = Date.now();
    if (typingActiveRef.current && now - lastTypingSentAtRef.current < TYPING_PING_MS) return;

    typingActiveRef.current = true;
    lastTypingSentAtRef.current = now;
    void sendTypingSignal(threadId, true);
  }, []);

  const clearActive = useCallback(() => {
    dispatch(setActiveThreadId(null));
  }, [dispatch]);

  return {
    ...chat,
    activeThread,
    currentUserId,
    isAuthenticated,
    totalUnread,
    hasOlderMessages,
    peerIsTyping,
    refreshThreads,
    markRead,
    selectThread,
    openThread,
    loadOlderMessages,
    syncActiveThread,
    send,
    notifyTyping,
    clearActive,
    getErrorMessage: getApiErrorMessage,
  };
}
