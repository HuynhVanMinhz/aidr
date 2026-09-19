/**
 * Sellers should never have to hand-write JSON. These helpers sit between the
 * structured editors and the `*Json` strings the API still stores.
 *
 * Parsing is deliberately forgiving and always reports whether it recognised
 * the shape: a legacy value the editor cannot represent must surface a raw-text
 * escape hatch rather than be silently rewritten, or someone loses data the
 * moment they open the form.
 */

export type ParseResult<T> = { value: T; recognized: boolean };

let rowSeq = 0;
const nextRowId = () => `row-${(rowSeq += 1)}`;

/* ------------------------------------------------------------------ tags */

/**
 * Accepts `["a","b"]`, and also a bare `a, b` - sellers who typed the old field
 * without brackets had their tags dropped on save, and the comma form is what
 * they reach for anyway.
 */
export function parseTagList(json: string): ParseResult<string[]> {
  const trimmed = json.trim();
  if (!trimmed) return { value: [], recognized: true };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      const tags = parsed
        .filter((t) => t != null && typeof t !== 'object')
        .map((t) => String(t).trim())
        .filter(Boolean);
      return { value: dedupe(tags), recognized: tags.length === parsed.length };
    }
    return { value: [], recognized: false };
  } catch {
    // Not JSON at all: treat it as the comma-separated list it looks like.
    if (trimmed.includes('{') || trimmed.includes('[')) return { value: [], recognized: false };
    return { value: dedupe(splitTags(trimmed)), recognized: true };
  }
}

export function serializeTagList(tags: string[]): string {
  const clean = dedupe(tags);
  return clean.length ? JSON.stringify(clean) : '';
}

export function splitTags(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/* ------------------------------------------------------- key/value pairs */

export type KeyValueRow = { id: string; key: string; value: string };

export function parseKeyValueRows(json: string): ParseResult<KeyValueRow[]> {
  const trimmed = json.trim();
  if (!trimmed) return { value: [], recognized: true };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: [], recognized: false };
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    // A nested object or array has no cell to live in; keep the raw editor.
    if (entries.some(([, v]) => v != null && typeof v === 'object')) {
      return { value: [], recognized: false };
    }

    return {
      value: entries.map(([key, value]) => ({
        id: nextRowId(),
        key,
        value: value == null ? '' : String(value),
      })),
      recognized: true,
    };
  } catch {
    return { value: [], recognized: false };
  }
}

export function serializeKeyValueRows(rows: KeyValueRow[]): string {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    out[key] = row.value.trim();
  }
  return Object.keys(out).length ? JSON.stringify(out) : '';
}

export function emptyKeyValueRow(): KeyValueRow {
  return { id: nextRowId(), key: '', value: '' };
}

/* ----------------------------------------------------------- opening hours */

export const OPENING_HOURS_DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
] as const;

export type OpeningHoursDayKey = (typeof OPENING_HOURS_DAYS)[number]['key'];

export type OpeningHoursDay = { open: string; close: string; closed: boolean };

export type OpeningHoursWeek = Record<OpeningHoursDayKey, OpeningHoursDay>;

export const DEFAULT_OPEN = '09:00';
export const DEFAULT_CLOSE = '18:00';

export function emptyOpeningHoursWeek(): OpeningHoursWeek {
  return OPENING_HOURS_DAYS.reduce((week, day) => {
    week[day.key] = { open: DEFAULT_OPEN, close: DEFAULT_CLOSE, closed: true };
    return week;
  }, {} as OpeningHoursWeek);
}

export function parseOpeningHours(json: string): ParseResult<OpeningHoursWeek> {
  const week = emptyOpeningHoursWeek();
  const trimmed = json.trim();
  if (!trimmed) return { value: week, recognized: true };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { value: week, recognized: false };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { value: week, recognized: false };
  }

  const known = new Set<string>(OPENING_HOURS_DAYS.map((d) => d.key));

  for (const [rawKey, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    const key = rawKey.trim().slice(0, 3).toLowerCase();
    // An unknown day key, or hours we cannot split into two times, means the
    // grid would quietly drop something. Hand it back as raw JSON instead.
    if (!known.has(key)) return { value: week, recognized: false };
    if (typeof rawValue !== 'string') return { value: week, recognized: false };

    const range = parseTimeRange(rawValue);
    if (!range) return { value: week, recognized: false };

    week[key as OpeningHoursDayKey] = { ...range, closed: false };
  }

  return { value: week, recognized: true };
}

export function serializeOpeningHours(week: OpeningHoursWeek): string {
  const out: Record<string, string> = {};
  for (const day of OPENING_HOURS_DAYS) {
    const entry = week[day.key];
    if (entry.closed || !entry.open || !entry.close) continue;
    out[day.key] = `${entry.open}-${entry.close}`;
  }
  return Object.keys(out).length ? JSON.stringify(out) : '';
}

/** "9:00-18:00", "09:00 - 18:00" and "9h-18h" all mean the same thing. */
function parseTimeRange(raw: string): { open: string; close: string } | null {
  const parts = raw.split(/[-–-]/);
  if (parts.length !== 2) return null;

  const open = normalizeTime(parts[0]);
  const close = normalizeTime(parts[1]);
  return open && close ? { open, close } : null;
}

function normalizeTime(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\s*[:h]?\s*(\d{2})?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
