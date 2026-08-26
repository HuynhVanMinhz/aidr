import type { NotificationItem } from '../types/notification';

export type NotificationAudience = 'buyer' | 'seller';

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function notificationTypeLabel(type: string): string {
  switch (type?.toLowerCase()) {
    case 'order':
      return 'Order';
    case 'payment':
      return 'Payment';
    case 'moderation':
      return 'Moderation';
    case 'return':
      return 'Return';
    case 'chat':
      return 'Chat';
    case 'promo':
      return 'Promo';
    case 'system':
      return 'System';
    default:
      return type || 'Notice';
  }
}

export function getNotificationHref(
  item: NotificationItem,
  audience: NotificationAudience,
): string | null {
  const refType = (item.referenceType ?? '').toLowerCase();
  const refId = item.referenceId;

  if (!refId) {
    if (audience === 'seller') return '/seller/notifications';
    return '/account/notifications';
  }

  if (refType === 'order' || item.type.toLowerCase() === 'order' || item.type.toLowerCase() === 'payment') {
    return audience === 'seller' ? `/seller/orders/${refId}` : `/account/orders/${refId}`;
  }

  if (refType === 'product' || item.type.toLowerCase() === 'moderation') {
    if (audience === 'seller') {
      // System low-stock alerts deep-link to inventory; moderation stays on product detail.
      if (item.type.toLowerCase() === 'system') {
        return `/seller/products/${refId}/inventory`;
      }
      return `/seller/products/${refId}`;
    }
    return `/products/${refId}`;
  }

  if (refType === 'returnrequest' || item.type.toLowerCase() === 'return') {
    return audience === 'seller' ? '/seller/orders' : '/account/orders';
  }

  if (refType === 'chatthread' || item.type.toLowerCase() === 'chat') {
    return audience === 'seller' ? `/seller/chat?threadId=${refId}` : `/chat?threadId=${refId}`;
  }

  return null;
}
