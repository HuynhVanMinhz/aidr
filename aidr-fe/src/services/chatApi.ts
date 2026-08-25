import type {
  ChatMessageApiResult,
  ChatMessageListApiResult,
  ChatMessageListQuery,
  ChatThreadApiResult,
  ChatThreadListApiResult,
  ChatThreadListQuery,
  MarkChatThreadReadApiResult,
  OpenChatThreadRequest,
  SendChatMessageRequest,
} from '../types/chat';
import { apiClient } from './apiClient';

export async function getChatThreads(query?: ChatThreadListQuery) {
  const { data } = await apiClient.get<ChatThreadListApiResult>('/chat/threads', {
    params: {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    },
  });
  return data;
}

export async function getChatThread(threadId: string) {
  const { data } = await apiClient.get<ChatThreadApiResult>(`/chat/threads/${threadId}`);
  return data;
}

export async function openChatThread(body: OpenChatThreadRequest) {
  const { data } = await apiClient.post<ChatThreadApiResult>('/chat/threads', body);
  return data;
}

export async function getChatMessages(threadId: string, query?: ChatMessageListQuery) {
  const { data } = await apiClient.get<ChatMessageListApiResult>(
    `/chat/threads/${threadId}/messages`,
    {
      params: {
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 30,
      },
    },
  );
  return data;
}

export async function sendChatMessage(threadId: string, body: SendChatMessageRequest) {
  const { data } = await apiClient.post<ChatMessageApiResult>(
    `/chat/threads/${threadId}/messages`,
    body,
  );
  return data;
}

export async function markChatThreadRead(threadId: string) {
  const { data } = await apiClient.post<MarkChatThreadReadApiResult>(
    `/chat/threads/${threadId}/read`,
  );
  return data;
}
