import type { CatalogFilters } from '../store/catalogSlice';
import { defaultCatalogFilters } from '../store/catalogSlice';
import type { AiChatSlots, NlFilterResult } from '../types/ai';
import type { ProductSort } from '../types/catalog';
import { filtersToSearchParams as filtersToUrlParams } from './catalogFilterUtils';

const ALLOWED_SORTS: ProductSort[] = ['newest', 'price_asc', 'price_desc', 'popular', 'rating'];

/** Map NL filter / chat slots into catalog list filters. */
export function slotsOrNlToCatalogFilters(source: AiChatSlots | NlFilterResult | null | undefined): CatalogFilters {
  if (!source) return { ...defaultCatalogFilters };

  const sortRaw = (source.sort ?? 'newest').toString().toLowerCase();
  const sort = ALLOWED_SORTS.includes(sortRaw as ProductSort)
    ? (sortRaw as ProductSort)
    : 'newest';

  let minRating: number | null = null;
  if (source.minRating != null && !Number.isNaN(Number(source.minRating))) {
    const n = Math.round(Number(source.minRating));
    if (n >= 1 && n <= 5) minRating = n;
  }

  const categoryIds =
    source.categoryId != null && !Number.isNaN(Number(source.categoryId))
      ? [Number(source.categoryId)]
      : [];

  const brand = (source.brand ?? '').toString().trim();

  return {
    ...defaultCatalogFilters,
    q: (source.q ?? '').toString().trim(),
    categoryIds,
    brands: brand ? [brand] : [],
    minPrice: source.minPrice != null ? String(Math.round(Number(source.minPrice))) : '',
    maxPrice: source.maxPrice != null ? String(Math.round(Number(source.maxPrice))) : '',
    minRating,
    sort,
    page: 1,
  };
}

/** Build `/products?...` query from chat slots for “See all matching products”. */
export function catalogFiltersToSearchParams(filters: CatalogFilters): string {
  const qs = filtersToUrlParams(filters).toString();
  return qs ? `/products?${qs}` : '/products';
}

export function formatSlotChips(slots: AiChatSlots | null | undefined): string[] {
  if (!slots) return [];
  const chips: string[] = [];
  if (slots.brand?.trim()) chips.push(slots.brand.trim());
  if (slots.categoryName?.trim()) chips.push(slots.categoryName.trim());
  if (slots.maxPrice != null && !Number.isNaN(Number(slots.maxPrice))) {
    chips.push(`≤ ${Math.round(Number(slots.maxPrice)).toLocaleString('vi-VN')} ₫`);
  } else if (slots.minPrice != null && !Number.isNaN(Number(slots.minPrice))) {
    chips.push(`≥ ${Math.round(Number(slots.minPrice)).toLocaleString('vi-VN')} ₫`);
  }
  if (slots.minRating != null) chips.push(`${Number(slots.minRating)}★+`);
  if (slots.sort && slots.sort !== 'newest' && slots.sort !== 'popular') {
    chips.push(`sort: ${slots.sort}`);
  }
  return chips;
}

/**
 * Product cards render rating + review count on their own line, so any clause in the reason
 * that just restates them would show the same numbers twice. Older conversations keep their
 * reason text in message meta, so stripping on render also cleans up rehydrated history.
 */
const RATING_ONLY_CLAUSES = [
  /^rating\s*[\d.,]+$/,
  /^[\d.,]+\s*(?:★|\/\s*5|stars?|sao)(?:\s*\(\s*[\d.,]+\s*(?:reviews?|ratings?|đánh giá)\s*\))?$/,
  /^[\d.,]+\s*(?:reviews?|ratings?|đánh giá)$/,
  // A clause left as a bare number ("4.3") is the rating with its label split off.
  /^[\d.,]+$/,
];

export function stripRatingFromReason(reason: string | null | undefined): string {
  if (!reason) return '';
  return reason
    .split('·')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !RATING_ONLY_CLAUSES.some((re) => re.test(part.toLowerCase())))
    .join(' · ');
}
