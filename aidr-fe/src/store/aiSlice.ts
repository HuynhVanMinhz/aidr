import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as aiApi from '../services/aiApi';
import type {
  AiChatAction,
  AiChatContext,
  AiChatResult,
  AiChatSlots,
  AiConsultState,
  AiQuickReply,
  AiConversationSummary,
  AiMessage,
  AiSuggestedProduct,
  CompareProductsResult,
  CompareSelectionItem,
  NlFilterResult,
} from '../types/ai';
import { getApiErrorMessage } from '../utils/apiError';

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 5;
export const AI_CHAT_MAX_LENGTH = 2000;
/** Mirrors AiConstants.MaxConsultQuestions - MetaJson stores progress without the cap. */
export const AI_MAX_CONSULT_QUESTIONS = 3;
const COMPARE_STORAGE_KEY = 'aidr.compare.selection';

export type AiState = {
  nlLoading: boolean;
  nlError: string | null;
  lastNlResult: NlFilterResult | null;
  selection: CompareSelectionItem[];
  compareLoading: boolean;
  compareError: string | null;
  compareResult: CompareProductsResult | null;
  conversations: AiConversationSummary[];
  conversationsPage: number;
  conversationsTotal: number;
  conversationsLoading: boolean;
  conversationsError: string | null;
  activeConversationId: string | null;
  activeTitle: string | null;
  messages: AiMessage[];
  messagesLoading: boolean;
  messagesError: string | null;
  chatSending: boolean;
  chatError: string | null;
  lastChatSource: string | null;
  lastIntent: string | null;
  lastSlots: AiChatSlots | null;
  lastActions: AiChatAction[];
  lastQuickReplies: AiQuickReply[];
  lastConsult: AiConsultState | null;
};

type AiRoot = { ai: AiState };

function loadSelection(): CompareSelectionItem[] {
  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompareSelectionItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.productId === 'string' && typeof x.name === 'string')
      .slice(0, COMPARE_MAX);
  } catch {
    return [];
  }
}

function persistSelection(selection: CompareSelectionItem[]) {
  try {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // ignore quota / private mode
  }
}

function requireData<T>(
  result: { success: boolean; data?: T | null; message?: string | null },
  fallback: string,
): T {
  if (!result.success || result.data == null) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

function upsertConversationSummary(
  list: AiConversationSummary[],
  result: AiChatResult,
): AiConversationSummary[] {
  const preview = result.assistantMessage.content;
  const next: AiConversationSummary = {
    conversationId: result.conversationId,
    channel: 'ShoppingAssistant',
    title: result.title ?? null,
    createdAt: result.userMessage.createdAt,
    updatedAt: result.assistantMessage.createdAt,
    lastMessagePreview: preview.length > 120 ? `${preview.slice(0, 120)}…` : preview,
    messageCount: 0,
  };

  const without = list.filter((c) => c.conversationId !== result.conversationId);
  const existing = list.find((c) => c.conversationId === result.conversationId);
  if (existing) {
    next.createdAt = existing.createdAt;
    next.messageCount = existing.messageCount + 2;
  } else {
    next.messageCount = 2;
  }
  return [next, ...without];
}

const initialState: AiState = {
  nlLoading: false,
  nlError: null,
  lastNlResult: null,
  selection: typeof window !== 'undefined' ? loadSelection() : [],
  compareLoading: false,
  compareError: null,
  compareResult: null,
  conversations: [],
  conversationsPage: 1,
  conversationsTotal: 0,
  conversationsLoading: false,
  conversationsError: null,
  activeConversationId: null,
  activeTitle: null,
  messages: [],
  messagesLoading: false,
  messagesError: null,
  chatSending: false,
  chatError: null,
  lastChatSource: null,
  lastIntent: null,
  lastSlots: null,
  lastActions: [],
  lastQuickReplies: [],
  lastConsult: null,
};

export const parseNlFilter = createAsyncThunk(
  'ai/parseNlFilter',
  async (query: string, { rejectWithValue }) => {
    try {
      const result = await aiApi.parseNlFilter({ query });
      return requireData(result, 'Unable to convert your search into filters.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to convert your search into filters.'));
    }
  },
);

export const runCompare = createAsyncThunk(
  'ai/runCompare',
  async (productIds: string[], { rejectWithValue }) => {
    try {
      const result = await aiApi.compareProducts({ productIds });
      return requireData(result, 'Unable to compare products.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to compare products.'));
    }
  },
);

export const loadAiConversations = createAsyncThunk(
  'ai/loadConversations',
  async (args: { page?: number; pageSize?: number } | undefined, { rejectWithValue }) => {
    try {
      const page = args?.page ?? 1;
      const pageSize = args?.pageSize ?? 20;
      const result = await aiApi.listAiConversations(page, pageSize);
      const data = requireData(result, 'Unable to load conversations.');
      return { page, data };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load conversations.'));
    }
  },
);

export const loadAiConversation = createAsyncThunk(
  'ai/loadConversation',
  async (conversationId: string, { rejectWithValue }) => {
    try {
      const result = await aiApi.getAiConversation(conversationId);
      return requireData(result, 'Unable to open conversation.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to open conversation.'));
    }
  },
);

export const sendAiChat = createAsyncThunk(
  'ai/sendChat',
  async (
    args: {
      message: string;
      conversationId?: string | null;
      context?: AiChatContext | null;
      quickReplyValue?: string | null;
    },
    { rejectWithValue },
  ) => {
    try {
      const result = await aiApi.sendAiChat({
        message: args.message,
        conversationId: args.conversationId ?? null,
        context: args.context ?? null,
        quickReplyValue: args.quickReplyValue ?? null,
      });
      return requireData(result, 'Unable to send message to the shopping assistant.');
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, 'Unable to send message to the shopping assistant.'),
      );
    }
  },
);

export const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearNlFilterState(state) {
      state.nlError = null;
      state.lastNlResult = null;
    },
    toggleCompareSelection(state, action: PayloadAction<CompareSelectionItem>) {
      const item = action.payload;
      const idx = state.selection.findIndex((x) => x.productId === item.productId);
      if (idx >= 0) {
        state.selection.splice(idx, 1);
        persistSelection(state.selection);
        return;
      }
      if (state.selection.length >= COMPARE_MAX) {
        return;
      }
      state.selection.push(item);
      persistSelection(state.selection);
    },
    removeCompareSelection(state, action: PayloadAction<string>) {
      state.selection = state.selection.filter((x) => x.productId !== action.payload);
      persistSelection(state.selection);
    },
    clearCompareSelection(state) {
      state.selection = [];
      persistSelection(state.selection);
      state.compareResult = null;
      state.compareError = null;
    },
    clearCompareResult(state) {
      state.compareResult = null;
      state.compareError = null;
    },
    startNewAiConversation(state) {
      state.activeConversationId = null;
      state.activeTitle = null;
      state.messages = [];
      state.messagesError = null;
      state.chatError = null;
      state.lastChatSource = null;
      state.lastIntent = null;
      state.lastSlots = null;
      state.lastActions = [];
      state.lastQuickReplies = [];
      state.lastConsult = null;
    },
    clearAiAssistantState(state) {
      state.conversations = [];
      state.conversationsPage = 1;
      state.conversationsTotal = 0;
      state.conversationsError = null;
      state.activeConversationId = null;
      state.activeTitle = null;
      state.messages = [];
      state.messagesError = null;
      state.chatError = null;
      state.lastChatSource = null;
      state.lastIntent = null;
      state.lastSlots = null;
      state.lastActions = [];
      state.lastQuickReplies = [];
      state.lastConsult = null;
    },
    clearAiChatSlots(state) {
      state.lastSlots = null;
      state.lastActions = [];
      state.lastQuickReplies = [];
      state.lastConsult = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(parseNlFilter.pending, (state) => {
        state.nlLoading = true;
        state.nlError = null;
      })
      .addCase(parseNlFilter.fulfilled, (state, action) => {
        state.nlLoading = false;
        state.lastNlResult = action.payload;
        state.nlError = null;
      })
      .addCase(parseNlFilter.rejected, (state, action) => {
        state.nlLoading = false;
        state.nlError =
          (action.payload as string) || action.error.message || 'Unable to convert your search into filters.';
      })
      .addCase(runCompare.pending, (state) => {
        state.compareLoading = true;
        state.compareError = null;
      })
      .addCase(runCompare.fulfilled, (state, action) => {
        state.compareLoading = false;
        state.compareResult = action.payload;
        state.compareError = null;
      })
      .addCase(runCompare.rejected, (state, action) => {
        state.compareLoading = false;
        state.compareError =
          (action.payload as string) || action.error.message || 'Unable to compare products.';
      })
      .addCase(loadAiConversations.pending, (state) => {
        state.conversationsLoading = true;
        state.conversationsError = null;
      })
      .addCase(loadAiConversations.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversations = action.payload.data.items;
        state.conversationsPage = action.payload.data.page;
        state.conversationsTotal = action.payload.data.totalCount;
      })
      .addCase(loadAiConversations.rejected, (state, action) => {
        state.conversationsLoading = false;
        state.conversationsError =
          (action.payload as string) || action.error.message || 'Unable to load conversations.';
      })
      .addCase(loadAiConversation.pending, (state) => {
        state.messagesLoading = true;
        state.messagesError = null;
      })
      .addCase(loadAiConversation.fulfilled, (state, action) => {
        state.messagesLoading = false;
        state.activeConversationId = action.payload.conversationId;
        state.activeTitle = action.payload.title ?? null;
        state.messages = action.payload.messages.map((m) => ({
          ...m,
          suggestedProducts: m.suggestedProducts ?? undefined,
        }));
        state.chatError = null;

        const lastAssistant = [...action.payload.messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant?.metaJson) {
          try {
            const meta = JSON.parse(lastAssistant.metaJson) as {
              intent?: string;
              slots?: AiChatSlots;
              actions?: AiChatAction[];
              quickReplies?: AiQuickReply[];
              consult?: AiConsultState;
              source?: string;
            };
            state.lastIntent = meta.intent ?? null;
            state.lastSlots = meta.slots ?? null;
            state.lastActions = meta.actions ?? [];
            // Reopening a half-finished consultation restores its chips and progress.
            state.lastQuickReplies = meta.quickReplies ?? [];
            state.lastConsult = meta.consult
              ? { ...meta.consult, maxQuestions: meta.consult.maxQuestions ?? AI_MAX_CONSULT_QUESTIONS }
              : null;
            state.lastChatSource = meta.source ?? state.lastChatSource;
          } catch {
            state.lastIntent = null;
            state.lastSlots = null;
            state.lastActions = [];
            state.lastQuickReplies = [];
            state.lastConsult = null;
          }
        } else {
          state.lastIntent = null;
          state.lastSlots = null;
          state.lastActions = [];
          state.lastQuickReplies = [];
          state.lastConsult = null;
        }
      })
      .addCase(loadAiConversation.rejected, (state, action) => {
        state.messagesLoading = false;
        state.messagesError =
          (action.payload as string) || action.error.message || 'Unable to open conversation.';
      })
      .addCase(sendAiChat.pending, (state) => {
        state.chatSending = true;
        state.chatError = null;
      })
      .addCase(sendAiChat.fulfilled, (state, action) => {
        state.chatSending = false;
        const result = action.payload;
        const products: AiSuggestedProduct[] = result.suggestedProducts ?? [];
        const assistant: AiMessage = {
          ...result.assistantMessage,
          suggestedProducts: products,
        };
        state.activeConversationId = result.conversationId;
        state.activeTitle = result.title ?? state.activeTitle;
        state.messages = [...state.messages, result.userMessage, assistant];
        state.lastChatSource = result.source;
        state.lastIntent = result.intent ?? null;
        state.lastSlots = result.slots ?? null;
        state.lastActions = result.actions ?? [];
        state.lastQuickReplies = result.quickReplies ?? [];
        state.lastConsult = result.consult ?? null;
        state.conversations = upsertConversationSummary(state.conversations, result);
      })
      .addCase(sendAiChat.rejected, (state, action) => {
        state.chatSending = false;
        state.chatError =
          (action.payload as string) ||
          action.error.message ||
          'Unable to send message to the shopping assistant.';
      });
  },
});

export const {
  clearNlFilterState,
  toggleCompareSelection,
  removeCompareSelection,
  clearCompareSelection,
  clearCompareResult,
  startNewAiConversation,
  clearAiAssistantState,
  clearAiChatSlots,
} = aiSlice.actions;

export const selectNlLoading = (state: AiRoot) => state.ai.nlLoading;
export const selectNlError = (state: AiRoot) => state.ai.nlError;
export const selectLastNlResult = (state: AiRoot) => state.ai.lastNlResult;

export const selectCompareSelection = (state: AiRoot) => state.ai.selection;
export const selectIsInCompare = (productId: string) => (state: AiRoot) =>
  state.ai.selection.some((x) => x.productId === productId);
export const selectCompareLoading = (state: AiRoot) => state.ai.compareLoading;
export const selectCompareError = (state: AiRoot) => state.ai.compareError;
export const selectCompareResult = (state: AiRoot) => state.ai.compareResult;

export const selectAiConversations = (state: AiRoot) => state.ai.conversations;
export const selectAiConversationsLoading = (state: AiRoot) => state.ai.conversationsLoading;
export const selectAiConversationsError = (state: AiRoot) => state.ai.conversationsError;
export const selectActiveAiConversationId = (state: AiRoot) => state.ai.activeConversationId;
export const selectActiveAiTitle = (state: AiRoot) => state.ai.activeTitle;
export const selectAiMessages = (state: AiRoot) => state.ai.messages;
export const selectAiMessagesLoading = (state: AiRoot) => state.ai.messagesLoading;
export const selectAiMessagesError = (state: AiRoot) => state.ai.messagesError;
export const selectAiChatSending = (state: AiRoot) => state.ai.chatSending;
export const selectAiChatError = (state: AiRoot) => state.ai.chatError;
export const selectAiLastChatSource = (state: AiRoot) => state.ai.lastChatSource;
export const selectAiLastIntent = (state: AiRoot) => state.ai.lastIntent;
export const selectAiLastSlots = (state: AiRoot) => state.ai.lastSlots;
export const selectAiLastActions = (state: AiRoot) => state.ai.lastActions;
export const selectAiLastQuickReplies = (state: AiRoot) => state.ai.lastQuickReplies;
export const selectAiLastConsult = (state: AiRoot) => state.ai.lastConsult;
