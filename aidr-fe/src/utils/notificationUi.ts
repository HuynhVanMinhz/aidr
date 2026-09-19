import type { NotificationItem } from '../types/notification';
import { parseUtcDate } from './dateUtc';

export type NotificationAudience = 'buyer' | 'seller' | 'admin';

export function formatNotificationTime(iso: string): string {
  const date = parseUtcDate(iso);
  if (!date) return '';

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
    if (audience === 'admin') return '/admin/notifications';
    if (audience === 'seller') return '/seller/notifications';
    return '/account/notifications';
  }

  if (refType === 'order' || item.type.toLowerCase() === 'order' || item.type.toLowerCase() === 'payment') {
    if (audience === 'admin') return `/admin/orders/${refId}`;
    return audience === 'seller' ? `/seller/orders/${refId}` : `/account/orders/${refId}`;
  }

  if (refType === 'product' || item.type.toLowerCase() === 'moderation') {
    if (audience === 'admin') return `/admin/products/${refId}`;
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
    if (audience === 'admin') return `/admin/return-requests/${refId}`;
    return audience === 'seller' ? `/seller/returns/${refId}` : `/account/returns/${refId}`;
  }

  if (refType === 'chatthread' || item.type.toLowerCase() === 'chat') {
    if (audience === 'admin') return '/admin/notifications';
    return audience === 'seller' ? `/seller/chat?threadId=${refId}` : `/chat?threadId=${refId}`;
  }

  return null;
}
