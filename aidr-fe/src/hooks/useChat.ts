import { useCallback, useEffect, useMemo } from 'react';
import { selectIsAuthenticated } from '../store/authSlice';
import {
  fetchChatMessages,
  fetchChatThreads,
  markChatThreadRead,
  openChatThread,
  selectChat,
  sendChatMessage,
  setActiveThreadId,
} from '../store/chatSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { OpenChatThreadRequest, SendChatMessageRequest } from '../types/chat';
import { getApiErrorMessage } from '../utils/apiError';

export function useChat(options?: { autoLoadThreads?: boolean }) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const chat = useAppSelector(selectChat);
  const autoLoadThreads = options?.autoLoadThreads ?? true;

  useEffect(() => {
    if (!autoLoadThreads || !isAuthenticated) return;
    void dispatch(fetchChatThreads({ page: 1, pageSize: 50 }));
  }, [autoLoadThreads, dispatch, isAuthenticated]);

  const activeThread = useMemo(
    () => chat.threads.find((t) => t.threadId === chat.activeThreadId) ?? null,
    [chat.activeThreadId, chat.threads],
  );

  const refreshThreads = useCallback(
    () => dispatch(fetchChatThreads({ page: 1, pageSize: 50 })).unwrap(),
    [dispatch],
  );

  const selectThread = useCallback(
    async (threadId: string) => {
      dispatch(setActiveThreadId(threadId));
      await dispatch(fetchChatMessages({ threadId, page: 1, pageSize: 30 })).unwrap();
      await dispatch(markChatThreadRead(threadId)).unwrap();
    },
    [dispatch],
  );

  const openThread = useCallback(
    async (body: OpenChatThreadRequest) => {
      const thread = await dispatch(openChatThread(body)).unwrap();
      await dispatch(fetchChatMessages({ threadId: thread.threadId, page: 1, pageSize: 30 })).unwrap();
      await dispatch(markChatThreadRead(thread.threadId)).unwrap();
      return thread;
    },
    [dispatch],
  );

  const send = useCallback(
    async (threadId: string, body: SendChatMessageRequest) => {
      const result = await dispatch(sendChatMessage({ threadId, body }));
      if (sendChatMessage.rejected.match(result)) {
        throw new Error(result.payload || 'Unable to send message.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const clearActive = useCallback(() => {
    dispatch(setActiveThreadId(null));
  }, [dispatch]);

  return {
    ...chat,
    activeThread,
    isAuthenticated,
    refreshThreads,
    selectThread,
    openThread,
    send,
    clearActive,
    getErrorMessage: getApiErrorMessage,
  };
}
