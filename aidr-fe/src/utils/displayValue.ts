/**
 * Helpers for user-facing empty / null / blank values (English UI).
 */

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

/** Show trimmed text, or a contextual empty label when null/blank. */
export function displayText(
  value: string | null | undefined,
  emptyLabel: string,
): string {
  if (isBlank(value)) return emptyLabel;
  return value!.trim();
}

/** Format a countable optional value (e.g. warranty months). */
export function displayOptionalNumber(
  value: number | null | undefined,
  format: (n: number) => string,
  emptyLabel: string,
): string {
  if (value == null) return emptyLabel;
  return format(value);
}
