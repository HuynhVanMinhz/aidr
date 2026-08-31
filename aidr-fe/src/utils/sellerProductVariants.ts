import type {
  SellerProductDetail,
  SellerProductVariantInput,
  SellerProductVariantOption,
} from '../types/seller';

/**
 * The seller-side variant editor.
 *
 * The seller declares the axes ("Color" -> Orange, White; "Storage" -> 128GB, 256GB) and
 * the editor generates the grid of combinations to price. Regenerating must not throw away
 * work: a combination that already has a price — or worse, an id and stock behind it — has
 * to survive, and only genuinely new or genuinely removed combinations should change.
 */

export type VariantDraft = {
  /** Stable key for React; the combination itself, which is unique by construction. */
  key: string;
  /** Absent until the row has been saved once. */
  variantId?: string;
  attributes: Record<string, string>;
  sku: string;
  price: string;
  salePrice: string;
  imageUrl: string;
  isActive: boolean;
  /** Read-only, from inventory lots. Undefined for a row that has never been saved. */
  stockQuantity?: number;
  reservedQuantity?: number;
};

export type VariantOptionDraft = {
  name: string;
  values: string[];
};

export const MAX_VARIANT_OPTIONS = 4;
export const MAX_VARIANT_OPTION_VALUES = 20;
export const MAX_VARIANTS = 100;

/** Combination identity, in declared axis order so it is stable across renders. */
export function combinationKey(
  options: VariantOptionDraft[],
  attributes: Record<string, string>,
): string {
  return options.map((o) => `${o.name}=${attributes[o.name] ?? ''}`).join('|');
}

export function variantLabel(
  options: VariantOptionDraft[],
  attributes: Record<string, string>,
): string {
  return options
    .map((o) => attributes[o.name])
    .filter(Boolean)
    .join(' / ');
}

function cartesian(options: VariantOptionDraft[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (rows, option) =>
      rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.name]: value }))),
    [{}],
  );
}

/**
 * Rebuilds the grid for the current axes, carrying over everything the seller already
 * entered for combinations that still exist. Rows whose combination no longer exists are
 * dropped — the API refuses to delete one that holds stock or sits on an order, so a
 * mistake here surfaces as an error rather than as silent data loss.
 */
export function regenerateVariantGrid(
  options: VariantOptionDraft[],
  existing: VariantDraft[],
  defaults?: { price?: string },
): VariantDraft[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (usable.length === 0) return [];

  const byKey = new Map(existing.map((row) => [row.key, row]));

  return cartesian(usable)
    .slice(0, MAX_VARIANTS)
    .map((attributes) => {
      const key = combinationKey(usable, attributes);
      const previous = byKey.get(key);
      if (previous) return { ...previous, key, attributes };

      return {
        key,
        attributes,
        sku: '',
        price: defaults?.price ?? '',
        salePrice: '',
        imageUrl: '',
        isActive: true,
      } satisfies VariantDraft;
    });
}

/** How many combinations the current axes would produce, before the cap is applied. */
export function combinationCount(options: VariantOptionDraft[]): number {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (usable.length === 0) return 0;
  return usable.reduce((total, option) => total * option.values.length, 1);
}

export function detailToVariantDrafts(detail: SellerProductDetail): {
  options: VariantOptionDraft[];
  rows: VariantDraft[];
} {
  const options: VariantOptionDraft[] = (detail.variantOptions ?? []).map((o) => ({
    name: o.name,
    values: [...o.values],
  }));

  const rows: VariantDraft[] = (detail.variants ?? []).map((v) => ({
    key: combinationKey(options, v.attributes),
    variantId: v.variantId,
    attributes: { ...v.attributes },
    sku: v.sku ?? '',
    price: String(v.price),
    salePrice: v.salePrice != null ? String(v.salePrice) : '',
    imageUrl: v.imageUrl ?? '',
    isActive: v.isActive,
    stockQuantity: v.stockQuantity,
    reservedQuantity: v.reservedQuantity,
  }));

  return { options, rows };
}

export type VariantValidationResult = {
  /** Keyed by draft key; only rows with a problem appear. */
  rowErrors: Record<string, string>;
  formError: string | null;
};

export function validateVariantDrafts(
  options: VariantOptionDraft[],
  rows: VariantDraft[],
): VariantValidationResult {
  const rowErrors: Record<string, string> = {};

  // Nothing declared at all is valid: the product is simply sold at one price.
  if (options.length === 0 && rows.length === 0) {
    return { rowErrors, formError: null };
  }

  if (options.length > MAX_VARIANT_OPTIONS) {
    return { rowErrors, formError: `At most ${MAX_VARIANT_OPTIONS} options are allowed.` };
  }

  const names = options.map((o) => o.name.trim());
  if (names.some((n) => !n)) {
    return { rowErrors, formError: 'Every option needs a name.' };
  }

  const lowered = names.map((n) => n.toLowerCase());
  if (new Set(lowered).size !== lowered.length) {
    return { rowErrors, formError: 'Option names must be unique.' };
  }

  const emptyAxis = options.find((o) => o.values.length === 0);
  if (emptyAxis) {
    return { rowErrors, formError: `Option "${emptyAxis.name}" needs at least one value.` };
  }

  const overfull = options.find((o) => o.values.length > MAX_VARIANT_OPTION_VALUES);
  if (overfull) {
    return {
      rowErrors,
      formError: `Option "${overfull.name}" may have at most ${MAX_VARIANT_OPTION_VALUES} values.`,
    };
  }

  if (rows.length === 0) {
    return { rowErrors, formError: 'Generate the variant list before saving.' };
  }

  if (rows.length > MAX_VARIANTS) {
    return { rowErrors, formError: `At most ${MAX_VARIANTS} variants are allowed.` };
  }

  const skus = new Map<string, string>();

  for (const row of rows) {
    const price = Number(row.price);
    if (!row.price.trim() || !Number.isFinite(price) || price < 0) {
      rowErrors[row.key] = 'Enter a price of 0 or more.';
      continue;
    }

    if (row.salePrice.trim()) {
      const sale = Number(row.salePrice);
      if (!Number.isFinite(sale) || sale < 0) {
        rowErrors[row.key] = 'Sale price must be 0 or more.';
        continue;
      }
      if (sale > price) {
        rowErrors[row.key] = 'Sale price cannot exceed the price.';
        continue;
      }
    }

    const sku = row.sku.trim().toLowerCase();
    if (sku) {
      const clash = skus.get(sku);
      if (clash) {
        rowErrors[row.key] = 'This SKU is already used by another variant.';
        continue;
      }
      skus.set(sku, row.key);
    }
  }

  if (!rows.some((r) => r.isActive)) {
    return { rowErrors, formError: 'At least one variant must be active.' };
  }

  return { rowErrors, formError: null };
}

export function draftsToPayload(
  options: VariantOptionDraft[],
  rows: VariantDraft[],
): { variantOptions: SellerProductVariantOption[]; variants: SellerProductVariantInput[] } {
  return {
    variantOptions: options.map((o) => ({ name: o.name.trim(), values: [...o.values] })),
    variants: rows.map((row, index) => ({
      variantId: row.variantId ?? null,
      sku: row.sku.trim() || null,
      // Left blank so the API derives "Orange / 128GB" — one place decides the format.
      variantName: null,
      attributes: row.attributes,
      price: Number(row.price),
      salePrice: row.salePrice.trim() ? Number(row.salePrice) : null,
      imageUrl: row.imageUrl.trim() || null,
      sortOrder: index,
      isActive: row.isActive,
    })),
  };
}
