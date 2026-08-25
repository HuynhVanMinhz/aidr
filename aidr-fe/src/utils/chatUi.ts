export function formatChatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function threadPeerName(thread: {
  myRole: string;
  buyerFullName: string;
  shopName: string;
}): string {
  return thread.myRole.toLowerCase() === 'seller' ? thread.buyerFullName : thread.shopName;
}

export function threadPeerAvatar(thread: {
  myRole: string;
  buyerAvatarUrl?: string | null;
  shopLogoUrl?: string | null;
}): string | null {
  return thread.myRole.toLowerCase() === 'seller'
    ? thread.buyerAvatarUrl ?? null
    : thread.shopLogoUrl ?? null;
}

export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : '?';
}

export function buildChatPath(options?: {
  threadId?: string | null;
  shopId?: string | null;
  productId?: string | null;
  seller?: boolean;
}): string {
  const base = options?.seller ? '/seller/chat' : '/chat';
  const params = new URLSearchParams();
  if (options?.threadId) params.set('threadId', options.threadId);
  if (options?.shopId) params.set('shopId', options.shopId);
  if (options?.productId) params.set('productId', options.productId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
