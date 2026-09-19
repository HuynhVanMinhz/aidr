const HAS_TIMEZONE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * API timestamps are UTC. SQL datetime2 strips Kind, so older responses (and some
 * SignalR payloads) may omit the Z suffix. `new Date(...)` would treat those as
 * local time and shift display by the browser offset — pin them to UTC.
 */
export function parseUtcDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const date = new Date(HAS_TIMEZONE.test(trimmed) ? trimmed : `${trimmed}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatUtcDateTime(
  iso: string | null | undefined,
  emptyLabel = '-',
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseUtcDate(iso);
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date);
}

export function formatUtcDate(
  iso: string | null | undefined,
  emptyLabel = '-',
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseUtcDate(iso);
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
}
