import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as chatApi from '../services/chatApi';
import type {
  ChatMessage,
  ChatMessageListResult,
  ChatThread,
  ChatThreadListResult,
  MarkChatThreadReadResponse,
  OpenChatThreadRequest,
  SendChatMessageRequest,
} from '../types/chat';
import { getApiErrorMessage } from '../utils/apiError';

export type ChatState = {
  threads: ChatThread[];
  threadPage: number;
  threadPageSize: number;
  threadTotalCount: number;
  threadTotalPages: number;
  activeThreadId: string | null;
  messages: ChatMessage[];
  messagePage: number;
  messagePageSize: number;
  messageTotalCount: number;
  messageTotalPages: number;
  loadingThreads: boolean;
  loadingMessages: boolean;
  sending: boolean;
  opening: boolean;
  error: string | null;
  threadsLoaded: boolean;
};

type ChatRoot = { chat: ChatState };

const initialState: ChatState = {
  threads: [],
  threadPage: 1,
  threadPageSize: 20,
  threadTotalCount: 0,
  threadTotalPages: 0,
  activeThreadId: null,
  messages: [],
  messagePage: 1,
  messagePageSize: 30,
  messageTotalCount: 0,
  messageTotalPages: 0,
  loadingThreads: false,
  loadingMessages: false,
  sending: false,
  opening: false,
  error: null,
  threadsLoaded: false,
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

function upsertThread(threads: ChatThread[], thread: ChatThread): ChatThread[] {
  const without = threads.filter((row) => row.threadId !== thread.threadId);
  return [thread, ...without].sort((a, b) => {
    const aTime = a.lastMessageAt ?? a.createdAt;
    const bTime = b.lastMessageAt ?? b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export const fetchChatThreads = createAsyncThunk<
  ChatThreadListResult,
  { page?: number; pageSize?: number } | undefined,
  { rejectValue: string }
>('chat/fetchThreads', async (query, { rejectWithValue }) => {
  try {
    const result = await chatApi.getChatThreads(query);
    return requireData(result, 'Unable to load chat threads.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load chat threads.'));
  }
});

export const openChatThread = createAsyncThunk<
  ChatThread,
  OpenChatThreadRequest,
  { rejectValue: string }
>('chat/openThread', async (body, { rejectWithValue }) => {
  try {
    const result = await chatApi.openChatThread(body);
    return requireData(result, 'Unable to open chat thread.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to open chat thread.'));
  }
});

export const fetchChatMessages = createAsyncThunk<
  { threadId: string; list: ChatMessageListResult },
  { threadId: string; page?: number; pageSize?: number },
  { rejectValue: string }
>('chat/fetchMessages', async ({ threadId, page, pageSize }, { rejectWithValue }) => {
  try {
    const result = await chatApi.getChatMessages(threadId, { page, pageSize });
    return {
      threadId,
      list: requireData(result, 'Unable to load messages.'),
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load messages.'));
  }
});

export const sendChatMessage = createAsyncThunk<
  ChatMessage,
  { threadId: string; body: SendChatMessageRequest },
  { rejectValue: string }
>('chat/sendMessage', async ({ threadId, body }, { rejectWithValue }) => {
  try {
    const result = await chatApi.sendChatMessage(threadId, body);
    return requireData(result, 'Unable to send message.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to send message.'));
  }
});

export const markChatThreadRead = createAsyncThunk<
  MarkChatThreadReadResponse,
  string,
  { rejectValue: string }
>('chat/markRead', async (threadId, { rejectWithValue }) => {
  try {
    const result = await chatApi.markChatThreadRead(threadId);
    return requireData(result, 'Unable to mark thread as read.');
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to mark thread as read.'));
  }
});

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    clearChatState() {
      return { ...initialState };
    },
    setActiveThreadId(state, action: PayloadAction<string | null>) {
      state.activeThreadId = action.payload;
      if (!action.payload) {
        state.messages = [];
        state.messagePage = 1;
        state.messageTotalCount = 0;
        state.messageTotalPages = 0;
      }
    },
    chatMessageReceived(
      state,
      action: PayloadAction<{ message: ChatMessage; currentUserId?: string | null }>,
    ) {
      const { message, currentUserId } = action.payload;
      const isMine = Boolean(currentUserId && message.senderUserId === currentUserId);
      const normalized: ChatMessage = { ...message, isMine };

      if (state.activeThreadId === normalized.threadId) {
        if (!state.messages.some((row) => row.messageId === normalized.messageId)) {
          state.messages = [...state.messages, normalized];
          state.messageTotalCount += 1;
        }
      }

      const existing = state.threads.find((t) => t.threadId === normalized.threadId);
      if (existing) {
        const nextUnread =
          state.activeThreadId === normalized.threadId || isMine
            ? existing.unreadCount
            : existing.unreadCount + 1;

        const updated: ChatThread = {
          ...existing,
          lastMessagePreview: normalized.content?.trim()
            ? normalized.content.trim()
            : normalized.attachmentUrl
              ? 'Attachment'
              : existing.lastMessagePreview,
          lastMessageAt: normalized.createdAt,
          unreadCount: nextUnread,
        };
        state.threads = upsertThread(state.threads, updated);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(clearSession, () => ({ ...initialState }))
      .addCase(fetchChatThreads.pending, (state) => {
        state.loadingThreads = true;
        state.error = null;
      })
      .addCase(fetchChatThreads.fulfilled, (state, action) => {
        state.loadingThreads = false;
        state.threads = action.payload.items ?? [];
        state.threadPage = action.payload.page;
        state.threadPageSize = action.payload.pageSize;
        state.threadTotalCount = action.payload.totalCount;
        state.threadTotalPages = action.payload.totalPages;
        state.threadsLoaded = true;
      })
      .addCase(fetchChatThreads.rejected, (state, action) => {
        state.loadingThreads = false;
        state.error = action.payload ?? 'Unable to load chat threads.';
      })
      .addCase(openChatThread.pending, (state) => {
        state.opening = true;
        state.error = null;
      })
      .addCase(openChatThread.fulfilled, (state, action) => {
        state.opening = false;
        state.threads = upsertThread(state.threads, action.payload);
        state.activeThreadId = action.payload.threadId;
        if (!state.threadsLoaded) {
          state.threadTotalCount = Math.max(state.threadTotalCount, state.threads.length);
        }
      })
      .addCase(openChatThread.rejected, (state, action) => {
        state.opening = false;
        state.error = action.payload ?? 'Unable to open chat thread.';
      })
      .addCase(fetchChatMessages.pending, (state) => {
        state.loadingMessages = true;
        state.error = null;
      })
      .addCase(fetchChatMessages.fulfilled, (state, action) => {
        state.loadingMessages = false;
        if (state.activeThreadId !== action.payload.threadId) return;

        const list = action.payload.list;
        state.messages = list.items ?? [];
        state.messagePage = list.page;
        state.messagePageSize = list.pageSize;
        state.messageTotalCount = list.totalCount;
        state.messageTotalPages = list.totalPages;
      })
      .addCase(fetchChatMessages.rejected, (state, action) => {
        state.loadingMessages = false;
        state.error = action.payload ?? 'Unable to load messages.';
      })
      .addCase(sendChatMessage.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.sending = false;
        const message = { ...action.payload, isMine: true };
        if (state.activeThreadId === message.threadId) {
          if (!state.messages.some((row) => row.messageId === message.messageId)) {
            state.messages = [...state.messages, message];
            state.messageTotalCount += 1;
          }
        }

        const existing = state.threads.find((t) => t.threadId === message.threadId);
        if (existing) {
          state.threads = upsertThread(state.threads, {
            ...existing,
            lastMessagePreview: message.content?.trim()
              ? message.content.trim()
              : message.attachmentUrl
                ? 'Attachment'
                : existing.lastMessagePreview,
            lastMessageAt: message.createdAt,
          });
        }
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload ?? 'Unable to send message.';
      })
      .addCase(markChatThreadRead.fulfilled, (state, action) => {
        const threadId = action.payload.threadId;
        state.threads = state.threads.map((thread) =>
          thread.threadId === threadId ? { ...thread, unreadCount: 0 } : thread,
        );
        if (state.activeThreadId === threadId) {
          state.messages = state.messages.map((message) =>
            message.isMine ? message : { ...message, isRead: true },
          );
        }
      });
  },
});

export const { clearChatState, setActiveThreadId, chatMessageReceived } = chatSlice.actions;

export const selectChat = (state: ChatRoot) => state.chat;
export const selectChatThreads = (state: ChatRoot) => state.chat.threads;
export const selectActiveThreadId = (state: ChatRoot) => state.chat.activeThreadId;
export const selectChatMessages = (state: ChatRoot) => state.chat.messages;
export const selectChatLoadingThreads = (state: ChatRoot) => state.chat.loadingThreads;
export const selectChatLoadingMessages = (state: ChatRoot) => state.chat.loadingMessages;
export const selectChatSending = (state: ChatRoot) => state.chat.sending;
export const selectChatError = (state: ChatRoot) => state.chat.error;
