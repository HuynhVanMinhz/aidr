import type { ApiResult } from './auth';
import type { PagedResult } from './catalog';

export type ChatThread = {
  threadId: string;
  buyerUserId: string;
  buyerFullName: string;
  buyerAvatarUrl?: string | null;
  shopId: string;
  shopName: string;
  shopLogoUrl?: string | null;
  shopOwnerUserId: string;
  productId?: string | null;
  productName?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  myRole: string;
  createdAt: string;
};

export type ChatMessage = {
  messageId: string;
  threadId: string;
  senderUserId: string;
  senderFullName: string;
  senderAvatarUrl?: string | null;
  content: string;
  attachmentUrl?: string | null;
  isRead: boolean;
  isMine: boolean;
  createdAt: string;
};

export type OpenChatThreadRequest = {
  shopId: string;
  productId?: string | null;
};

export type SendChatMessageRequest = {
  content?: string | null;
  attachmentUrl?: string | null;
};

export type MarkChatThreadReadResponse = {
  threadId: string;
  updatedCount: number;
};

export type ChatThreadListQuery = {
  page?: number;
  pageSize?: number;
};

export type ChatMessageListQuery = {
  page?: number;
  pageSize?: number;
};

export type ChatThreadListResult = PagedResult<ChatThread>;
export type ChatMessageListResult = PagedResult<ChatMessage>;

export type ChatThreadListApiResult = ApiResult<ChatThreadListResult>;
export type ChatThreadApiResult = ApiResult<ChatThread>;
export type ChatMessageListApiResult = ApiResult<ChatMessageListResult>;
export type ChatMessageApiResult = ApiResult<ChatMessage>;
export type MarkChatThreadReadApiResult = ApiResult<MarkChatThreadReadResponse>;
