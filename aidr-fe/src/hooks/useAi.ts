import { useCallback } from 'react';
import {
  AI_CHAT_MAX_LENGTH,
  COMPARE_MAX,
  clearAiAssistantState,
  clearAiChatSlots,
  clearCompareResult,
  clearCompareSelection,
  loadAiConversation,
  loadAiConversations,
  parseNlFilter,
  removeCompareSelection,
  runCompare,
  selectActiveAiConversationId,
  selectActiveAiTitle,
  selectAiChatError,
  selectAiChatSending,
  selectAiConversations,
  selectAiConversationsError,
  selectAiConversationsLoading,
  selectAiLastActions,
  selectAiLastChatSource,
  selectAiLastConsult,
  selectAiLastIntent,
  selectAiLastQuickReplies,
  selectAiLastSlots,
  selectAiMessages,
  selectAiMessagesError,
  selectAiMessagesLoading,
  selectCompareError,
  selectCompareLoading,
  selectCompareResult,
  selectCompareSelection,
  selectIsInCompare,
  selectLastNlResult,
  selectNlError,
  selectNlLoading,
  sendAiChat,
  startNewAiConversation,
  toggleCompareSelection,
} from '../store/aiSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { AiChatContext, CompareSelectionItem } from '../types/ai';
import { getApiErrorMessage } from '../utils/apiError';

export function useNlFilter() {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectNlLoading);
  const error = useAppSelector(selectNlError);
  const lastResult = useAppSelector(selectLastNlResult);

  const parse = useCallback(
    async (query: string) => {
      const action = await dispatch(parseNlFilter(query));
      if (parseNlFilter.fulfilled.match(action)) {
        return action.payload;
      }
      throw new Error(
        (action.payload as string) || action.error.message || 'Unable to convert your search into filters.',
      );
    },
    [dispatch],
  );

  return { loading, error, lastResult, parse };
}

export function useCompare() {
  const dispatch = useAppDispatch();
  const selection = useAppSelector(selectCompareSelection);
  const loading = useAppSelector(selectCompareLoading);
  const error = useAppSelector(selectCompareError);
  const result = useAppSelector(selectCompareResult);

  const isSelected = useCallback(
    (productId: string) => selection.some((x) => x.productId === productId),
    [selection],
  );

  const toggle = useCallback(
    (item: CompareSelectionItem) => {
      if (!isSelected(item.productId) && selection.length >= COMPARE_MAX) {
        return { ok: false as const, reason: 'full' as const };
      }
      dispatch(toggleCompareSelection(item));
      return { ok: true as const };
    },
    [dispatch, isSelected, selection.length],
  );

  const remove = useCallback(
    (productId: string) => {
      dispatch(removeCompareSelection(productId));
    },
    [dispatch],
  );

  const clear = useCallback(() => {
    dispatch(clearCompareSelection());
  }, [dispatch]);

  const clearResult = useCallback(() => {
    dispatch(clearCompareResult());
  }, [dispatch]);

  const compare = useCallback(
    async (productIds?: string[]) => {
      const ids = productIds ?? selection.map((x) => x.productId);
      const action = await dispatch(runCompare(ids));
      if (runCompare.fulfilled.match(action)) {
        return action.payload;
      }
      throw new Error((action.payload as string) || action.error.message || 'Unable to compare products.');
    },
    [dispatch, selection],
  );

  return {
    selection,
    loading,
    error,
    result,
    isSelected,
    toggle,
    remove,
    clear,
    clearResult,
    compare,
    max: COMPARE_MAX,
  };
}

export function useCompareSelected(productId: string) {
  return useAppSelector(selectIsInCompare(productId));
}

export function useShoppingAssistant() {
  const dispatch = useAppDispatch();
  const conversations = useAppSelector(selectAiConversations);
  const conversationsLoading = useAppSelector(selectAiConversationsLoading);
  const conversationsError = useAppSelector(selectAiConversationsError);
  const activeConversationId = useAppSelector(selectActiveAiConversationId);
  const activeTitle = useAppSelector(selectActiveAiTitle);
  const messages = useAppSelector(selectAiMessages);
  const messagesLoading = useAppSelector(selectAiMessagesLoading);
  const messagesError = useAppSelector(selectAiMessagesError);
  const sending = useAppSelector(selectAiChatSending);
  const chatError = useAppSelector(selectAiChatError);
  const lastSource = useAppSelector(selectAiLastChatSource);
  const lastIntent = useAppSelector(selectAiLastIntent);
  const lastSlots = useAppSelector(selectAiLastSlots);
  const lastActions = useAppSelector(selectAiLastActions);
  const lastQuickReplies = useAppSelector(selectAiLastQuickReplies);
  const lastConsult = useAppSelector(selectAiLastConsult);

  const loadConversations = useCallback(
    async (page = 1) => {
      const action = await dispatch(loadAiConversations({ page }));
      if (loadAiConversations.fulfilled.match(action)) {
        return action.payload.data;
      }
      throw new Error(
        (action.payload as string) || action.error.message || 'Unable to load conversations.',
      );
    },
    [dispatch],
  );

  const openConversation = useCallback(
    async (conversationId: string) => {
      const action = await dispatch(loadAiConversation(conversationId));
      if (loadAiConversation.fulfilled.match(action)) {
        return action.payload;
      }
      throw new Error(
        (action.payload as string) || action.error.message || 'Unable to open conversation.',
      );
    },
    [dispatch],
  );

  const startNew = useCallback(() => {
    dispatch(startNewAiConversation());
  }, [dispatch]);

  const clearAll = useCallback(() => {
    dispatch(clearAiAssistantState());
  }, [dispatch]);

  const clearSlots = useCallback(() => {
    dispatch(clearAiChatSlots());
  }, [dispatch]);

  const send = useCallback(
    async (
      message: string,
      conversationId?: string | null,
      context?: AiChatContext | null,
      quickReplyValue?: string | null,
    ) => {
      const trimmed = message.trim();
      if (!trimmed) {
        throw new Error('Message is required.');
      }
      if (trimmed.length > AI_CHAT_MAX_LENGTH) {
        throw new Error(`Message must be at most ${AI_CHAT_MAX_LENGTH} characters.`);
      }
      const action = await dispatch(
        sendAiChat({
          message: trimmed,
          conversationId: conversationId ?? activeConversationId,
          context: context ?? null,
          quickReplyValue: quickReplyValue ?? null,
        }),
      );
      if (sendAiChat.fulfilled.match(action)) {
        return action.payload;
      }
      throw new Error(
        (action.payload as string) ||
          action.error.message ||
          'Unable to send message to the shopping assistant.',
      );
    },
    [activeConversationId, dispatch],
  );

  const getErrorMessage = useCallback(
    (error: unknown, fallback: string) => getApiErrorMessage(error, fallback),
    [],
  );

  return {
    conversations,
    conversationsLoading,
    conversationsError,
    activeConversationId,
    activeTitle,
    messages,
    messagesLoading,
    messagesError,
    sending,
    chatError,
    lastSource,
    lastIntent,
    lastSlots,
    lastActions,
    lastQuickReplies,
    lastConsult,
    maxLength: AI_CHAT_MAX_LENGTH,
    loadConversations,
    openConversation,
    startNew,
    clearAll,
    clearSlots,
    send,
    getErrorMessage,
  };
}
