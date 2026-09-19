import { useEffect, useState } from 'react';
import { getProduct, lookupProducts } from '../services/productApi';
import type { ProductDetail, ProductListItem } from '../types/catalog';

/** The subset a shared-product card needs, so it can be built from either endpoint. */
export type ChatProductSummary = {
  productId: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  salePrice: number | null;
  effectivePrice: number;
  currency: string;
  availableQuantity: number;
  shopName: string;
};

/**
 * Products resolved for link previews are immutable enough to keep for the session, and the same
 * product is usually referenced by several messages - so cache across component instances.
 */
const cache = new Map<string, ChatProductSummary>();
/** Ids the API confirmed are not in the catalogue any more - never ask again. */
const missing = new Set<string>();
/** Ids both endpoints failed on. Retried a bounded number of times. */
const failures = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();

const MAX_IDS_PER_CALL = 30;
const MAX_ATTEMPTS = 3;

export type ProductPreview =
  | { status: 'found'; product: ChatProductSummary }
  /** The server answered, and this product is not in the catalogue any more. */
  | { status: 'missing' }
  /** Both lookups failed - the card degrades to a plain link instead of a dead spinner. */
  | { status: 'unavailable' }
  | { status: 'loading' };

function fromListItem(p: ProductListItem): ChatProductSummary {
  return {
    productId: p.productId.toLowerCase(),
    name: p.name,
    imageUrl: p.primaryImageUrl ?? null,
    basePrice: p.basePrice,
    salePrice: p.salePrice ?? null,
    effectivePrice: p.effectivePrice,
    currency: p.currency,
    availableQuantity: p.availableQuantity,
    shopName: p.shopName,
  };
}

function fromDetail(p: ProductDetail): ChatProductSummary {
  const primary = p.images?.find((image) => image.isPrimary) ?? p.images?.[0];
  return {
    productId: p.productId.toLowerCase(),
    name: p.name,
    imageUrl: primary?.imageUrl ?? null,
    basePrice: p.basePrice,
    salePrice: p.salePrice ?? null,
    effectivePrice: p.effectivePrice,
    currency: p.currency,
    availableQuantity: p.availableQuantity,
    shopName: p.shop?.shopName ?? '',
  };
}

function needsLookup(id: string): boolean {
  if (cache.has(id) || missing.has(id)) return false;
  return (failures.get(id) ?? 0) < MAX_ATTEMPTS;
}

/**
 * Per-id fallback used when the batch endpoint is unreachable - it exists in every API build.
 * It does record a product view, which is why it is never the first choice, but a shared product
 * showing its real name and price matters more than a perfectly clean view counter.
 */
async function resolveOneByDetail(id: string): Promise<void> {
  try {
    const result = await getProduct(id);
    if (result.data) {
      cache.set(id, fromDetail(result.data));
      failures.delete(id);
    } else {
      missing.add(id);
    }
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    // A 404 here is authoritative: the product really is gone.
    if (status === 404) missing.add(id);
    else failures.set(id, (failures.get(id) ?? 0) + 1);
  }
}

async function resolveBatch(batch: string[]): Promise<void> {
  try {
    const result = await lookupProducts(batch);
    for (const product of result.data ?? []) {
      cache.set(product.productId.toLowerCase(), fromListItem(product));
    }
    // The batch endpoint answered, so anything it omitted is genuinely gone.
    for (const id of batch) {
      if (cache.has(id)) failures.delete(id);
      else missing.add(id);
    }
  } catch {
    // Endpoint missing (older API) or erroring - fall back to the per-product detail route.
    await Promise.all(batch.filter((id) => !cache.has(id)).map(resolveOneByDetail));
  }
}

async function resolve(ids: string[]): Promise<void> {
  const wanted = ids.filter(needsLookup);
  if (wanted.length === 0) return;

  const pending = wanted.filter((id) => inFlight.has(id));
  const fresh = wanted.filter((id) => !inFlight.has(id));

  for (let i = 0; i < fresh.length; i += MAX_IDS_PER_CALL) {
    const batch = fresh.slice(i, i + MAX_IDS_PER_CALL);
    const request = resolveBatch(batch).finally(() => {
      for (const id of batch) inFlight.delete(id);
    });

    for (const id of batch) inFlight.set(id, request);
  }

  await Promise.all([...new Set([...pending, ...fresh].map((id) => inFlight.get(id)))]);
}

function previewOf(id: string): ProductPreview {
  const product = cache.get(id);
  if (product) return { status: 'found', product };
  if (missing.has(id)) return { status: 'missing' };
  // One round of failures is enough to stop spinning: show a usable link now, keep retrying in
  // the background, and upgrade to the rich card if a later attempt succeeds.
  if ((failures.get(id) ?? 0) > 0) return { status: 'unavailable' };
  return { status: 'loading' };
}

/**
 * Resolve every product referenced by the conversation, batched where the API allows it.
 * Every requested id gets an entry, so a caller never has to guess why one is absent.
 */
export function useProductPreviews(productIds: string[]): Map<string, ProductPreview> {
  const key = productIds.join(',');
  const [, setVersion] = useState(0);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.some(needsLookup)) return;

    let cancelled = false;
    void resolve(ids).then(() => {
      if (!cancelled) setVersion((v) => v + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const previews = new Map<string, ProductPreview>();
  for (const id of productIds) previews.set(id, previewOf(id));
  return previews;
}
