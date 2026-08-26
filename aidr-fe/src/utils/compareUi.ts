import type { CompareDimension, CompareProductCard, CompareProductsResult } from '../types/ai';
import { formatMoney } from './formatCatalog';

export type CompareInsightKind = 'price' | 'rating' | 'ram' | 'storage' | 'other';

export type CompareInsight = {
  kind: CompareInsightKind;
  label: string;
  productId: string;
  productName: string;
  value: string;
};

export type CompareRecommendation = {
  productId: string;
  productName: string;
  headline: string;
  reason: string;
};

export type DimensionWinnerMap = Record<string, Set<string>>;

const EMPTY = {
  notAvailable: 'Not available',
  notSpecified: 'Not specified',
  noReviews: 'No reviews yet',
  noSales: 'No sales yet',
  noDiscount: 'No discount',
  outOfStock: 'Out of stock',
} as const;

const EMPTY_MARKERS = new Set([
  '—',
  '-',
  '–',
  'n/a',
  'na',
  'null',
  'undefined',
  EMPTY.notAvailable.toLowerCase(),
  EMPTY.notSpecified.toLowerCase(),
  EMPTY.noReviews.toLowerCase(),
  EMPTY.noSales.toLowerCase(),
  EMPTY.noDiscount.toLowerCase(),
]);

/** Keys where higher numeric value is better. */
const HIGHER_IS_BETTER = new Set([
  'rating',
  'reviews',
  'warranty',
  'ram',
  'storage',
  'screen',
  'display',
  'battery',
  'refresh_rate',
  'camera',
  'front_camera',
  'rear_camera',
  'discount',
  'stock',
  'sold',
]);

/** Keys where lower numeric value is better. */
const LOWER_IS_BETTER = new Set(['price', 'list_price', 'weight']);

const SPEC_LABELS: Record<string, string> = {
  ram: 'RAM',
  storage: 'Storage',
  screen: 'Screen',
  display: 'Display',
  refresh_rate: 'Refresh rate',
  battery: 'Battery',
  chip: 'Chip',
  cpu: 'CPU',
  gpu: 'GPU',
  camera: 'Camera',
  front_camera: 'Front camera',
  rear_camera: 'Rear camera',
  os: 'OS',
  weight: 'Weight',
  dimensions: 'Dimensions',
  connectivity: 'Connectivity',
  ports: 'Ports',
  audio: 'Audio',
  charging: 'Charging',
  sim: 'SIM',
  color: 'Color',
  material: 'Material',
};

const PRODUCT_DIM_ORDER: { key: string; label: string }[] = [
  { key: 'price', label: 'Price' },
  { key: 'list_price', label: 'List price' },
  { key: 'discount', label: 'Discount' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'category', label: 'Category' },
  { key: 'shop', label: 'Shop' },
  { key: 'condition', label: 'Condition' },
  { key: 'rating', label: 'Rating' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'origin', label: 'Origin' },
  { key: 'stock', label: 'In stock' },
  { key: 'sold', label: 'Sold' },
  { key: 'tags', label: 'Tags' },
];

function isComparableKey(key: string): boolean {
  return HIGHER_IS_BETTER.has(key) || LOWER_IS_BETTER.has(key);
}

function isEmptyDisplay(raw?: string | null): boolean {
  if (raw == null) return true;
  const t = raw.trim();
  if (!t) return true;
  return EMPTY_MARKERS.has(t.toLowerCase());
}

function parseLeadingNumber(raw: string): number | null {
  if (isEmptyDisplay(raw)) return null;
  const normalized = raw.replace(/,/g, '').replace(/\s+/g, ' ').trim();
  const match = normalized.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parseRamGb(raw: string): number | null {
  const n = parseLeadingNumber(raw);
  if (n == null) return null;
  if (/tb/i.test(raw) && !/gb/i.test(raw)) return n * 1024;
  return n;
}

function parseStorageGb(raw: string): number | null {
  return parseRamGb(raw);
}

function toSpecLabel(key: string): string {
  const lower = key.toLowerCase();
  if (SPEC_LABELS[lower]) return SPEC_LABELS[lower];
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function numericForDimension(key: string, raw: string, product?: CompareProductCard): number | null {
  if (product) {
    if (key === 'price') return product.effectivePrice;
    if (key === 'list_price') return product.basePrice;
    if (key === 'rating') return product.reviewCount > 0 ? product.avgRating : null;
    if (key === 'reviews') return product.reviewCount > 0 ? product.reviewCount : null;
    if (key === 'warranty') return product.warrantyMonths ?? null;
    if (key === 'stock') return product.availableQuantity ?? null;
    if (key === 'sold') return product.soldCount != null && product.soldCount > 0 ? product.soldCount : null;
    if (key === 'discount') {
      if (
        product.salePrice == null ||
        product.salePrice <= 0 ||
        product.salePrice >= product.basePrice ||
        product.basePrice <= 0
      ) {
        return null;
      }
      return ((product.basePrice - product.salePrice) / product.basePrice) * 100;
    }
  }

  if (key === 'ram') return parseRamGb(raw);
  if (key === 'storage') return parseStorageGb(raw);
  if (key === 'stock' && /out of stock/i.test(raw)) return 0;
  return parseLeadingNumber(raw);
}

function productFieldValue(key: string, product: CompareProductCard): string {
  switch (key) {
    case 'price':
      return formatMoney(product.effectivePrice, product.currency);
    case 'list_price':
      return formatMoney(product.basePrice, product.currency);
    case 'discount': {
      if (
        product.salePrice == null ||
        product.salePrice <= 0 ||
        product.salePrice >= product.basePrice ||
        product.basePrice <= 0
      ) {
        return EMPTY.noDiscount;
      }
      return `${Math.round(((product.basePrice - product.salePrice) / product.basePrice) * 100)}%`;
    }
    case 'brand':
      return product.brand?.trim() || EMPTY.notSpecified;
    case 'model':
      return product.modelNumber?.trim() || EMPTY.notSpecified;
    case 'category':
      return product.categoryName?.trim() || EMPTY.notSpecified;
    case 'shop':
      return product.shopName?.trim() || EMPTY.notSpecified;
    case 'condition':
      return product.conditionType?.trim() || 'New';
    case 'rating':
      return product.reviewCount > 0 ? `${product.avgRating.toFixed(1)} ★` : EMPTY.noReviews;
    case 'reviews':
      return product.reviewCount > 0 ? String(product.reviewCount) : EMPTY.noReviews;
    case 'warranty':
      return product.warrantyMonths != null
        ? `${product.warrantyMonths} months`
        : EMPTY.notSpecified;
    case 'origin':
      return product.originCountry?.trim() || EMPTY.notSpecified;
    case 'stock': {
      const qty = product.availableQuantity ?? 0;
      return qty <= 0 ? EMPTY.outOfStock : `${qty} available`;
    }
    case 'sold':
      return product.soldCount != null && product.soldCount > 0
        ? String(product.soldCount)
        : EMPTY.noSales;
    case 'tags':
      return product.tags && product.tags.length > 0
        ? product.tags.join(', ')
        : EMPTY.notSpecified;
    default:
      return EMPTY.notAvailable;
  }
}

function formatSpecRaw(key: string, raw: string): string {
  if (isEmptyDisplay(raw)) return EMPTY.notAvailable;
  if (key === 'screen' || key === 'display') {
    const n = parseLeadingNumber(raw);
    if (n != null && !/"|inch|″/i.test(raw)) return `${n}"`;
  }
  return raw;
}

/** Rewrite bare amounts like `3690000 VND` inside AI summary text. */
export function formatPricesInText(text: string): string {
  if (!text) return text;
  return text
    .replace(/(\d[\d.,]*)\s*VND\b/gi, (_, raw: string) => {
      const n = Number(String(raw).replace(/[.,]/g, ''));
      return Number.isFinite(n) ? formatMoney(n, 'VND') : `${raw} VND`;
    })
    .replace(/(\d[\d.,]*)\s*₫/g, (_, raw: string) => {
      const n = Number(String(raw).replace(/[.,]/g, ''));
      return Number.isFinite(n) ? formatMoney(n, 'VND') : `${raw} ₫`;
    });
}

/**
 * Ensure compare table includes product fields + all specs from cards,
 * even when the API returns a short/fixed dimension list.
 */
export function enrichCompareDimensions(
  products: CompareProductCard[],
  dimensions: CompareDimension[],
): CompareDimension[] {
  if (products.length === 0) return dimensions;

  const byKey = new Map<string, CompareDimension>();
  for (const dim of dimensions) {
    byKey.set(dim.key.toLowerCase(), {
      ...dim,
      values: { ...dim.values },
    });
  }

  const hasSale = products.some(
    (p) => p.salePrice != null && p.salePrice > 0 && p.salePrice < p.basePrice,
  );

  for (const { key, label } of PRODUCT_DIM_ORDER) {
    if ((key === 'list_price' || key === 'discount') && !hasSale) continue;

    const existing = byKey.get(key);
    const values: Record<string, string> = {};
    for (const p of products) {
      values[p.productId] = productFieldValue(key, p);
    }
    byKey.set(key, {
      key: existing?.key ?? key,
      label: existing?.label ?? label,
      values,
    });
  }

  const specKeys = new Set<string>();
  for (const p of products) {
    for (const k of Object.keys(p.specs ?? {})) {
      specKeys.add(k.toLowerCase());
    }
  }
  // Also keep any spec dims already returned by API.
  for (const dim of dimensions) {
    const k = dim.key.toLowerCase();
    if (!PRODUCT_DIM_ORDER.some((d) => d.key === k)) {
      specKeys.add(k);
    }
  }

  const preferredOrder = Object.keys(SPEC_LABELS);
  const orderedSpecs = [
    ...preferredOrder.filter((k) => specKeys.has(k)),
    ...[...specKeys].filter((k) => !SPEC_LABELS[k]).sort(),
  ];

  for (const key of orderedSpecs) {
    if (PRODUCT_DIM_ORDER.some((d) => d.key === key)) continue;
    const existing = byKey.get(key);
    const values: Record<string, string> = {};
    for (const p of products) {
      const fromCard = p.specs?.[key] ?? p.specs?.[Object.keys(p.specs ?? {}).find((x) => x.toLowerCase() === key) ?? ''];
      const fromDim = existing?.values[p.productId];
      const raw = fromCard || fromDim || '';
      values[p.productId] = formatSpecRaw(key, raw);
    }
    // Skip rows where nobody has data.
    if (Object.values(values).every((v) => isEmptyDisplay(v))) continue;

    byKey.set(key, {
      key: existing?.key ?? key,
      label: existing?.label ?? toSpecLabel(key),
      values,
    });
  }

  const result: CompareDimension[] = [];
  const seen = new Set<string>();

  for (const { key } of PRODUCT_DIM_ORDER) {
    const dim = byKey.get(key);
    if (!dim) continue;
    result.push(dim);
    seen.add(key);
  }
  for (const key of orderedSpecs) {
    if (seen.has(key)) continue;
    const dim = byKey.get(key);
    if (!dim) continue;
    result.push(dim);
    seen.add(key);
  }
  for (const [key, dim] of byKey) {
    if (seen.has(key)) continue;
    result.push(dim);
  }

  return result;
}

export function formatCompareCell(dim: CompareDimension, product: CompareProductCard): string {
  const key = dim.key.toLowerCase();
  if (PRODUCT_DIM_ORDER.some((d) => d.key === key)) {
    return productFieldValue(key, product);
  }

  const fromCard =
    product.specs?.[key] ??
    product.specs?.[Object.keys(product.specs ?? {}).find((x) => x.toLowerCase() === key) ?? ''];
  const raw = fromCard || dim.values[product.productId] || '';
  return formatSpecRaw(key, raw);
}

export function buildDimensionWinners(
  products: CompareProductCard[],
  dimensions: CompareDimension[],
): DimensionWinnerMap {
  const map: DimensionWinnerMap = {};
  const byId = new Map(products.map((p) => [p.productId, p]));

  for (const dim of dimensions) {
    const key = dim.key.toLowerCase();
    if (!isComparableKey(key)) {
      map[dim.key] = new Set();
      continue;
    }

    const scored = products
      .map((p) => {
        const raw = formatCompareCell(dim, p);
        const score = numericForDimension(key, raw, byId.get(p.productId));
        return { productId: p.productId, score };
      })
      .filter((x): x is { productId: string; score: number } => x.score != null);

    if (scored.length < 2) {
      map[dim.key] = new Set();
      continue;
    }

    const preferHigher = HIGHER_IS_BETTER.has(key);
    const best = preferHigher
      ? Math.max(...scored.map((s) => s.score))
      : Math.min(...scored.map((s) => s.score));

    const allEqual = scored.every((s) => s.score === best);
    if (allEqual) {
      map[dim.key] = new Set();
      continue;
    }

    map[dim.key] = new Set(scored.filter((s) => s.score === best).map((s) => s.productId));
  }

  return map;
}

export function buildCompareInsights(
  products: CompareProductCard[],
  dimensions: CompareDimension[],
  winners: DimensionWinnerMap,
): CompareInsight[] {
  const insights: CompareInsight[] = [];
  const byId = new Map(products.map((p) => [p.productId, p]));

  const pushWinner = (dimKey: string, kind: CompareInsightKind, label: string) => {
    const dim = dimensions.find((d) => d.key.toLowerCase() === dimKey);
    if (!dim) return;

    const withData = products.filter((p) => {
      const cell = formatCompareCell(dim, p);
      return !isEmptyDisplay(cell);
    });
    // Spec insights only when multiple products actually have the attribute.
    if ((dimKey === 'ram' || dimKey === 'storage') && withData.length < 2) return;

    const ids = [...(winners[dim.key] ?? [])];
    if (ids.length !== 1) return;
    const product = byId.get(ids[0]);
    if (!product) return;
    insights.push({
      kind,
      label,
      productId: product.productId,
      productName: product.name,
      value: formatCompareCell(dim, product),
    });
  };

  pushWinner('price', 'price', 'Best Price');
  pushWinner('rating', 'rating', 'Best Rating');
  pushWinner('ram', 'ram', 'Best RAM');
  pushWinner('storage', 'storage', 'Best Storage');

  return insights.slice(0, 4);
}

export function buildCompareRecommendation(
  result: CompareProductsResult,
  winners: DimensionWinnerMap,
): CompareRecommendation | null {
  const { products, dimensions, summary } = result;
  if (products.length === 0) return null;

  const priceDim = dimensions.find((d) => d.key.toLowerCase() === 'price');
  const ratingDim = dimensions.find((d) => d.key.toLowerCase() === 'rating');
  const cheapestId = priceDim ? [...(winners[priceDim.key] ?? [])][0] : undefined;
  const topRatedId = ratingDim ? [...(winners[ratingDim.key] ?? [])][0] : undefined;

  const winCounts = new Map<string, number>();
  for (const p of products) winCounts.set(p.productId, 0);
  for (const set of Object.values(winners)) {
    for (const id of set) {
      winCounts.set(id, (winCounts.get(id) ?? 0) + 1);
    }
  }

  let bestId = products[0].productId;
  let bestScore = -1;
  for (const p of products) {
    const wins = winCounts.get(p.productId) ?? 0;
    const ratingBoost = p.reviewCount > 0 ? p.avgRating : 0;
    const priceBoost = 1 / Math.max(p.effectivePrice, 1);
    const score = wins * 10 + ratingBoost + priceBoost;
    if (score > bestScore) {
      bestScore = score;
      bestId = p.productId;
    }
  }

  if (cheapestId && cheapestId === topRatedId) {
    bestId = cheapestId;
  }

  const pick = products.find((p) => p.productId === bestId) ?? products[0];
  const winCount = winCounts.get(pick.productId) ?? 0;
  const isBestPrice = cheapestId === pick.productId;
  const isBestRating = topRatedId === pick.productId;

  const reasons: string[] = [];
  if (isBestPrice && isBestRating) {
    reasons.push('it leads on both price and customer rating');
  } else if (isBestPrice) {
    reasons.push(`it has the best price (${formatMoney(pick.effectivePrice, pick.currency)})`);
  } else if (isBestRating) {
    reasons.push(`it has the strongest rating (${pick.avgRating.toFixed(1)} ★)`);
  }
  if (winCount > 0) {
    reasons.push(`it wins ${winCount} comparison ${winCount === 1 ? 'criterion' : 'criteria'}`);
  }
  if (reasons.length === 0 && summary.trim()) {
    reasons.push(formatPricesInText(summary.trim()));
  }

  const reason =
    reasons.length > 0
      ? `Choose ${pick.name} because ${reasons.join(', and ')}.`
      : `Choose ${pick.name} based on the overall balance of price and features.`;

  return {
    productId: pick.productId,
    productName: pick.name,
    headline: `Recommended: ${pick.name}`,
    reason,
  };
}

export function productBadge(
  productId: string,
  insights: CompareInsight[],
  recommendation: CompareRecommendation | null,
): string | null {
  if (recommendation?.productId === productId) return 'Recommended';
  const insight = insights.find((i) => i.productId === productId);
  return insight?.label ?? null;
}
