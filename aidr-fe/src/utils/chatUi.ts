const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const HAS_TIMEZONE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * The API stores every timestamp in UTC, but values materialised from SQL come back with
 * DateTimeKind.Unspecified and therefore without a timezone suffix. `new Date(...)` would read
 * those as local time and shift the whole conversation by the UTC offset, so pin them to UTC.
 */
export function parseChatDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(HAS_TIMEZONE.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDate(iso: string | null | undefined): Date | null {
  return parseChatDate(iso);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/** Compact stamp for the conversation list: time today, "Yesterday", then a short date. */
export function formatChatTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return '';

  const now = new Date();
  if (isSameDay(date, now)) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (isSameDay(date, daysAgo(1))) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(
    undefined,
    sameYear
      ? { month: 'short', day: 'numeric' }
      : { year: '2-digit', month: 'short', day: 'numeric' },
  );
}

export function formatMessageTime(iso: string): string {
  const date = toDate(iso);
  if (!date) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Separator label between message groups: Today / Yesterday / full date. */
export function formatDayLabel(iso: string): string {
  const date = toDate(iso);
  if (!date) return '';

  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, daysAgo(1))) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Relative "last seen" style label used under the conversation header. */
export function formatRelativeActivity(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return '';

  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return 'Active just now';
  if (diff < HOUR) return `Active ${Math.round(diff / MINUTE)}m ago`;
  if (diff < 24 * HOUR) return `Active ${Math.round(diff / HOUR)}h ago`;
  return `Last message ${formatChatTime(iso)}`;
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
  const url =
    thread.myRole.toLowerCase() === 'seller' ? thread.buyerAvatarUrl : thread.shopLogoUrl;
  return url?.trim() ? url : null;
}

/** Up to two letters, so "TechZone Official" reads as "TO" rather than "T". */
export function avatarInitial(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
}

const AVATAR_HUES = [211, 262, 340, 24, 152, 194, 291, 44];

/** Stable per-peer colour so a fallback avatar keeps the same identity between renders. */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_HUES[hash % AVATAR_HUES.length]!;
}

export function threadPreviewText(thread: {
  lastMessagePreview?: string | null;
  lastMessageIsMine?: boolean;
  productName?: string | null;
}): string {
  const preview = thread.lastMessagePreview?.trim();
  if (preview) return thread.lastMessageIsMine ? `You: ${preview}` : preview;
  if (thread.productName) return `About: ${thread.productName}`;
  return 'No messages yet';
}

const IMAGE_URL = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;

export function isImageAttachment(url: string): boolean {
  return IMAGE_URL.test(url) || url.startsWith('data:image/');
}

export function attachmentFileName(url: string): string {
  try {
    const path = new URL(url, window.location.origin).pathname;
    const name = path.split('/').filter(Boolean).pop();
    return name ? decodeURIComponent(name) : 'Attachment';
  } catch {
    return 'Attachment';
  }
}

/* ── Product links ─────────────────────────────────────────────────────────
   A shared product travels inside the message text as a normal /products/{id}
   link. Nothing extra is stored, so a link the user pastes by hand renders the
   same rich card as one inserted from the picker.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Match a product detail URL ending at the GUID. Trailing typed text must not
 * become part of the link (composer chips + card render handle the product).
 */
const PRODUCT_LINK =
  /(?:https?:\/\/[^\s/]+)?\/products\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?![0-9a-fA-F-])/g;

export function buildProductLink(productId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/products/${productId}`;
}

/** Every product id referenced by a message body, in order and without duplicates. */
export function extractProductIds(content: string | null | undefined): string[] {
  if (!content) return [];
  const ids: string[] = [];
  for (const match of content.matchAll(PRODUCT_LINK)) {
    const id = match[1]!.toLowerCase();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The message text with product URLs removed — the card already shows them. */
export function stripProductLinks(content: string | null | undefined): string {
  if (!content) return '';
  return content.replace(PRODUCT_LINK, '').replace(/[ \t]{2,}/g, ' ').trim();
}

const URL_TOKEN = /(https?:\/\/[^\s]+)/g;

export type MessageTextPart = { type: 'text' | 'link'; value: string };

/** Split message text so plain URLs can render as anchors instead of dead text. */
export function splitMessageText(content: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(URL_TOKEN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, start) });
    }
    parts.push({ type: 'link', value: match[0] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return parts;
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
