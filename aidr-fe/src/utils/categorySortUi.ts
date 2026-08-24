export const CATEGORY_DISPLAY_ORDER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const ORDER_LABELS: Record<number, string> = {
  0: 'Default',
  1: 'First',
  2: 'Second',
  3: 'Third',
  4: 'Fourth',
  5: 'Fifth',
  6: 'Sixth',
  7: 'Seventh',
  8: 'Eighth',
  9: 'Ninth',
  10: 'Tenth',
};

/** Human-readable display order. DB still stores the integer. */
export function formatCategorySortOrder(sortOrder: number): string {
  return ORDER_LABELS[sortOrder] ?? `Position ${sortOrder}`;
}

export function categoryDisplayOrderOptions(current?: number) {
  const values = new Set<number>(CATEGORY_DISPLAY_ORDER_VALUES);
  if (typeof current === 'number' && Number.isInteger(current)) values.add(current);

  return [...values]
    .sort((a, b) => a - b)
    .map((value) => ({
      value: String(value),
      label: formatCategorySortOrder(value),
    }));
}

/** True when assigning parentId would nest a category under itself or a descendant. */
export function wouldCreateCategoryCycle(
  options: { categoryId: number; parentId?: number | null }[],
  categoryId: number,
  parentId: number,
): boolean {
  if (parentId === categoryId) return true;

  const byId = new Map(options.map((item) => [item.categoryId, item]));
  const seen = new Set<number>();
  let current: number | null | undefined = parentId;

  while (current) {
    if (current === categoryId) return true;
    if (!seen.add(current)) return true;
    current = byId.get(current)?.parentId ?? null;
  }

  return false;
}
