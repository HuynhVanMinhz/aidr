import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearSession } from './authSlice';
import * as chatApi from '../services/chatApi';
import type {
  ChatMessage,
  ChatMessageListResult,
  ChatThread,
  ChatThreadListResult,
  ChatThreadReadEvent,
  ChatTypingEvent,
  MarkChatThreadReadResponse,
  OpenChatThreadRequest,
  SendChatMessageRequest,
} from '../types/chat';
import { getApiErrorMessage } from '../utils/apiError';
import { parseChatDate } from '../utils/chatUi';

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
  loadingOlderMessages: boolean;
  sending: boolean;
  opening: boolean;
  error: string | null;
  threadsLoaded: boolean;
  /** threadId -> userId of the peer currently composing. */
  typingByThread: Record<string, string>;
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
  loadingOlderMessages: false,
  sending: false,
  opening: false,
  error: null,
  threadsLoaded: false,
  typingByThread: {},
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

function previewOf(message: ChatMessage, fallback: string | null | undefined): string | null {
  const content = message.content?.trim();
  if (content) return content;
  if (message.attachmentUrl) return 'Attachment';
  return fallback ?? null;
}

function byChronology(a: ChatMessage, b: ChatMessage): number {
  const diff =
    (parseChatDate(a.createdAt)?.getTime() ?? 0) - (parseChatDate(b.createdAt)?.getTime() ?? 0);
  return diff !== 0 ? diff : a.messageId.localeCompare(b.messageId);
}

function upsertThread(threads: ChatThread[], thread: ChatThread): ChatThread[] {
  const without = threads.filter((row) => row.threadId !== thread.threadId);
  return [thread, ...without].sort((a, b) => {
    const aTime = parseChatDate(a.lastMessageAt ?? a.createdAt)?.getTime() ?? 0;
    const bTime = parseChatDate(b.lastMessageAt ?? b.createdAt)?.getTime() ?? 0;
    return bTime - aTime;
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

/** Older page of a thread - page 1 is the newest chunk, higher pages go further back. */
export const fetchOlderChatMessages = createAsyncThunk<
  { threadId: string; list: ChatMessageListResult },
  { threadId: string; page: number; pageSize?: number },
  { rejectValue: string }
>('chat/fetchOlderMessages', async ({ threadId, page, pageSize }, { rejectWithValue }) => {
  try {
    const result = await chatApi.getChatMessages(threadId, { page, pageSize });
    return {
      threadId,
      list: requireData(result, 'Unable to load older messages.'),
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load older messages.'));
  }
});

/**
 * Re-read the newest page and merge it into what is already on screen. Used by the polling /
 * focus fallbacks: unlike fetchChatMessages it never drops older pages the reader scrolled back to.
 */
export const syncChatMessages = createAsyncThunk<
  { threadId: string; list: ChatMessageListResult },
  { threadId: string; pageSize?: number },
  { rejectValue: string }
>('chat/syncMessages', async ({ threadId, pageSize }, { rejectWithValue }) => {
  try {
    const result = await chatApi.getChatMessages(threadId, { page: 1, pageSize });
    return {
      threadId,
      list: requireData(result, 'Unable to sync messages.'),
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to sync messages.'));
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
      // Never let the previous conversation's messages flash inside the new one.
      if (state.activeThreadId !== action.payload) {
        state.messages = [];
        state.messagePage = 1;
        state.messageTotalCount = 0;
        state.messageTotalPages = 0;
      }
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
      // The server resolves isMine per recipient; recompute defensively when we know the user.
      const isMine = currentUserId
        ? message.senderUserId === currentUserId
        : Boolean(message.isMine);
      const normalized: ChatMessage = { ...message, isMine };

      if (state.activeThreadId === normalized.threadId) {
        if (!state.messages.some((row) => row.messageId === normalized.messageId)) {
          state.messages = [...state.messages, normalized];
          state.messageTotalCount += 1;
        }
      }

      // A delivered message ends any pending typing signal from its sender.
      if (state.typingByThread[normalized.threadId] === normalized.senderUserId) {
        delete state.typingByThread[normalized.threadId];
      }

      const existing = state.threads.find((t) => t.threadId === normalized.threadId);
      if (existing) {
        const nextUnread =
          state.activeThreadId === normalized.threadId || isMine
            ? existing.unreadCount
            : existing.unreadCount + 1;

        const updated: ChatThread = {
          ...existing,
          lastMessagePreview: previewOf(normalized, existing.lastMessagePreview),
          lastMessageIsMine: isMine,
          lastMessageAt: normalized.createdAt,
          unreadCount: nextUnread,
        };
        state.threads = upsertThread(state.threads, updated);
      }
    },
    chatThreadReadReceived(
      state,
      action: PayloadAction<{ event: ChatThreadReadEvent; currentUserId?: string | null }>,
    ) {
      const { threadId, readerUserId } = action.payload.event;
      const readByMe = action.payload.currentUserId === readerUserId;

      if (state.activeThreadId === threadId) {
        // The reader saw everything the other side had sent, so flip those ticks.
        state.messages = state.messages.map((message) =>
          message.isRead || message.senderUserId === readerUserId
            ? message
            : { ...message, isRead: true },
        );
      }

      // Only my own read (possibly from another device) clears my badge.
      if (readByMe) {
        state.threads = state.threads.map((thread) =>
          thread.threadId === threadId && thread.unreadCount > 0
            ? { ...thread, unreadCount: 0 }
            : thread,
        );
      }
    },
    chatTypingReceived(state, action: PayloadAction<ChatTypingEvent>) {
      const { threadId, userId, isTyping } = action.payload;
      if (isTyping) {
        state.typingByThread[threadId] = userId;
      } else if (state.typingByThread[threadId] === userId) {
        delete state.typingByThread[threadId];
      }
    },
    chatTypingCleared(state, action: PayloadAction<string>) {
      delete state.typingByThread[action.payload];
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
      .addCase(fetchOlderChatMessages.pending, (state) => {
        state.loadingOlderMessages = true;
      })
      .addCase(fetchOlderChatMessages.fulfilled, (state, action) => {
        state.loadingOlderMessages = false;
        if (state.activeThreadId !== action.payload.threadId) return;

        const list = action.payload.list;
        const known = new Set(state.messages.map((row) => row.messageId));
        const older = (list.items ?? []).filter((row) => !known.has(row.messageId));

        state.messages = [...older, ...state.messages];
        state.messagePage = list.page;
        state.messagePageSize = list.pageSize;
        state.messageTotalCount = list.totalCount;
        state.messageTotalPages = list.totalPages;
      })
      .addCase(fetchOlderChatMessages.rejected, (state, action) => {
        state.loadingOlderMessages = false;
        state.error = action.payload ?? 'Unable to load older messages.';
      })
      .addCase(syncChatMessages.fulfilled, (state, action) => {
        if (state.activeThreadId !== action.payload.threadId) return;

        const list = action.payload.list;
        const byId = new Map(state.messages.map((row) => [row.messageId, row]));
        let changed = false;

        for (const row of list.items ?? []) {
          const existing = byId.get(row.messageId);
          if (!existing) {
            byId.set(row.messageId, row);
            changed = true;
          } else if (existing.isRead !== row.isRead) {
            byId.set(row.messageId, { ...existing, isRead: row.isRead });
            changed = true;
          }
        }

        if (changed) state.messages = [...byId.values()].sort(byChronology);
        state.messageTotalCount = list.totalCount;
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
            lastMessagePreview: previewOf(message, existing.lastMessagePreview),
            lastMessageIsMine: true,
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

export const {
  clearChatState,
  setActiveThreadId,
  chatMessageReceived,
  chatThreadReadReceived,
  chatTypingReceived,
  chatTypingCleared,
} = chatSlice.actions;

export const selectChat = (state: ChatRoot) => state.chat;
export const selectChatThreads = (state: ChatRoot) => state.chat.threads;
export const selectActiveThreadId = (state: ChatRoot) => state.chat.activeThreadId;
export const selectChatMessages = (state: ChatRoot) => state.chat.messages;
export const selectChatLoadingThreads = (state: ChatRoot) => state.chat.loadingThreads;
export const selectChatLoadingMessages = (state: ChatRoot) => state.chat.loadingMessages;
export const selectChatSending = (state: ChatRoot) => state.chat.sending;
export const selectChatError = (state: ChatRoot) => state.chat.error;
export const selectChatTotalUnread = (state: ChatRoot) =>
  state.chat.threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
export const selectChatHasOlderMessages = (state: ChatRoot) =>
  state.chat.messageTotalCount > state.chat.messages.length;
