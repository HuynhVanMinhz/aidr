import type { CatalogFilters } from '../store/catalogSlice';
import { defaultCatalogFilters } from '../store/catalogSlice';
import type { CategoryTreeNode, ProductSort } from '../types/catalog';

const ALLOWED_SORTS: ProductSort[] = ['newest', 'price_asc', 'price_desc', 'popular', 'rating'];

const CONDITION_LABELS: Record<string, string> = {
  New: 'New',
  LikeNew: 'Like new',
  Refurbished: 'Refurbished',
  Used: 'Used',
};

export function parseCategoryIdsParam(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function parseBrandsParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function parseConditionsParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function parseSpecFiltersParam(raw: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw?.trim()) return result;
  for (const part of raw.split(',')) {
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    const key = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

export function parseFiltersFromSearch(params: URLSearchParams): CatalogFilters {
  const sortRaw = params.get('sort') || 'newest';
  const sort = ALLOWED_SORTS.includes(sortRaw as ProductSort) ? (sortRaw as ProductSort) : 'newest';

  const legacyCategoryId = params.get('categoryId');
  const categoryIdsFromLegacy =
    legacyCategoryId && !Number.isNaN(Number(legacyCategoryId)) ? [Number(legacyCategoryId)] : [];
  const categoryIds = params.has('categoryIds')
    ? parseCategoryIdsParam(params.get('categoryIds'))
    : categoryIdsFromLegacy;

  const legacyBrand = params.get('brand')?.trim() ?? '';
  const brands = params.has('brands') ? parseBrandsParam(params.get('brands')) : legacyBrand ? [legacyBrand] : [];

  const minRatingRaw = params.get('minRating');
  const minRating =
    minRatingRaw && !Number.isNaN(Number(minRatingRaw)) ? Number(minRatingRaw) : null;

  const pageRaw = params.get('page');
  const page = pageRaw && Number(pageRaw) > 0 ? Number(pageRaw) : 1;

  return {
    q: params.get('q') ?? '',
    categoryIds,
    brands,
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    minRating,
    onSale: params.get('onSale') === '1' ? true : null,
    inStock: params.get('inStock') === '1' ? true : null,
    conditions: parseConditionsParam(params.get('conditions')),
    specFilters: parseSpecFiltersParam(params.get('specFilters')),
    sort,
    page,
    pageSize: defaultCatalogFilters.pageSize,
  };
}

export function filtersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.categoryIds.length > 0) params.set('categoryIds', filters.categoryIds.join(','));
  if (filters.brands.length > 0) params.set('brands', filters.brands.join(','));
  if (filters.minPrice.trim()) params.set('minPrice', filters.minPrice.trim());
  if (filters.maxPrice.trim()) params.set('maxPrice', filters.maxPrice.trim());
  if (filters.minRating != null) params.set('minRating', String(filters.minRating));
  if (filters.onSale === true) params.set('onSale', '1');
  if (filters.inStock === true) params.set('inStock', '1');
  if (filters.conditions.length > 0) params.set('conditions', filters.conditions.join(','));
  const specEntries = Object.entries(filters.specFilters);
  if (specEntries.length > 0) {
    params.set(
      'specFilters',
      specEntries.map(([k, v]) => `${k}:${v}`).join(','),
    );
  }
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.brands.length > 0 ||
    filters.minPrice.trim().length > 0 ||
    filters.maxPrice.trim().length > 0 ||
    filters.minRating != null ||
    filters.onSale === true ||
    filters.inStock === true ||
    filters.conditions.length > 0 ||
    Object.keys(filters.specFilters).length > 0
  );
}

export type ActiveFilterChip = {
  key: string;
  label: string;
  clear: Partial<CatalogFilters>;
};

function findCategoryName(nodes: CategoryTreeNode[], categoryId: number): string | null {
  for (const node of nodes) {
    if (node.categoryId === categoryId) return node.name;
    const childName = findCategoryName(node.children ?? [], categoryId);
    if (childName) return childName;
  }
  return null;
}

export function buildActiveFilterChips(
  filters: CatalogFilters,
  categories: CategoryTreeNode[],
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (filters.q.trim()) {
    chips.push({ key: 'q', label: `Search: ${filters.q.trim()}`, clear: { q: '' } });
  }

  for (const categoryId of filters.categoryIds) {
    const name = findCategoryName(categories, categoryId) ?? `Category #${categoryId}`;
    chips.push({
      key: `category-${categoryId}`,
      label: name,
      clear: { categoryIds: filters.categoryIds.filter((id) => id !== categoryId) },
    });
  }

  for (const brand of filters.brands) {
    chips.push({
      key: `brand-${brand}`,
      label: `Brand: ${brand}`,
      clear: { brands: filters.brands.filter((b) => b !== brand) },
    });
  }

  if (filters.minPrice.trim() || filters.maxPrice.trim()) {
    const min = filters.minPrice.trim();
    const max = filters.maxPrice.trim();
    let label = 'Price';
    if (min && max) label = `Price: ${min} – ${max}`;
    else if (min) label = `Price from ${min}`;
    else if (max) label = `Price up to ${max}`;
    chips.push({ key: 'price', label, clear: { minPrice: '', maxPrice: '' } });
  }

  if (filters.minRating != null) {
    chips.push({
      key: 'rating',
      label: `${filters.minRating}★ & up`,
      clear: { minRating: null },
    });
  }

  if (filters.onSale === true) {
    chips.push({ key: 'onSale', label: 'On sale', clear: { onSale: null } });
  }

  if (filters.inStock === true) {
    chips.push({ key: 'inStock', label: 'In stock', clear: { inStock: null } });
  }

  for (const condition of filters.conditions) {
    chips.push({
      key: `cond-${condition}`,
      label: CONDITION_LABELS[condition] ?? condition,
      clear: { conditions: filters.conditions.filter((c) => c !== condition) },
    });
  }

  for (const [key, value] of Object.entries(filters.specFilters)) {
    chips.push({
      key: `spec-${key}-${value}`,
      label: `${key}: ${value}`,
      clear: {
        specFilters: Object.fromEntries(
          Object.entries(filters.specFilters).filter(([k]) => k !== key),
        ),
      },
    });
  }

  return chips;
}

export function toggleCategoryId(selected: number[], categoryId: number): number[] {
  return selected.includes(categoryId)
    ? selected.filter((id) => id !== categoryId)
    : [...selected, categoryId];
}

export function toggleBrand(selected: string[], brand: string): string[] {
  return selected.includes(brand) ? selected.filter((b) => b !== brand) : [...selected, brand];
}
