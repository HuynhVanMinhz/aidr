import type { ProductVariant, ProductVariantOption } from '../types/catalog';

/**
 * Matching a shopper's selection to a variant.
 *
 * The seller stores each variant's chosen value per axis ({"Color":"Orange"}), and the
 * axes separately. The picker therefore works the other way round from the data: it holds
 * one value per axis and has to find the single variant that agrees with all of them.
 */

export type VariantSelection = Record<string, string>;

export type VariantValueState = {
  value: string;
  /** No variant exists for this value alongside the rest of the current selection. */
  unavailable: boolean;
  /** A variant exists but nothing is left to sell. */
  outOfStock: boolean;
};

function matchesSelection(variant: ProductVariant, selection: VariantSelection): boolean {
  return Object.entries(selection).every(([axis, value]) => variant.attributes[axis] === value);
}

/** The variant the shopper has landed on, or null while the selection is still partial. */
export function findSelectedVariant(
  variants: ProductVariant[],
  options: ProductVariantOption[],
  selection: VariantSelection,
): ProductVariant | null {
  if (options.length === 0) return null;
  if (options.some((option) => !selection[option.name])) return null;

  return variants.find((variant) => matchesSelection(variant, selection)) ?? null;
}

/**
 * The variant to show before the shopper has touched anything: the cheapest one still in
 * stock, falling back to the cheapest overall so a sold-out product still shows a price.
 */
export function defaultSelection(
  variants: ProductVariant[],
  options: ProductVariantOption[],
): VariantSelection {
  if (options.length === 0 || variants.length === 0) return {};

  const inStock = variants.filter((v) => v.availableQuantity > 0);
  const pool = inStock.length > 0 ? inStock : variants;
  const cheapest = pool.reduce((best, v) => (v.effectivePrice < best.effectivePrice ? v : best));

  const selection: VariantSelection = {};
  for (const option of options) {
    const value = cheapest.attributes[option.name];
    if (value) selection[option.name] = value;
  }
  return selection;
}

/**
 * How each value on one axis should render, given what is picked on the *other* axes.
 * A 256GB that only comes in white must grey out while orange is selected, rather than
 * letting the shopper build a combination the seller never created.
 */
export function valueStatesForOption(
  option: ProductVariantOption,
  variants: ProductVariant[],
  selection: VariantSelection,
): VariantValueState[] {
  const others: VariantSelection = Object.fromEntries(
    Object.entries(selection).filter(([axis]) => axis !== option.name),
  );

  return option.values.map((value) => {
    const candidates = variants.filter(
      (variant) =>
        variant.attributes[option.name] === value && matchesSelection(variant, others),
    );

    return {
      value,
      unavailable: candidates.length === 0,
      outOfStock: candidates.length > 0 && candidates.every((v) => v.availableQuantity < 1),
    };
  });
}

/**
 * Picking a value can strand the other axes on a combination that does not exist, so any
 * axis left invalid is re-pointed at a value that does — the same way a size picker snaps
 * when you switch colour.
 */
export function applyValue(
  options: ProductVariantOption[],
  variants: ProductVariant[],
  selection: VariantSelection,
  axis: string,
  value: string,
): VariantSelection {
  const next: VariantSelection = { ...selection, [axis]: value };

  for (const option of options) {
    if (option.name === axis) continue;

    const stillValid = variants.some((variant) => matchesSelection(variant, next));
    if (stillValid) continue;

    const partial: VariantSelection = Object.fromEntries(
      Object.entries(next).filter(([name]) => name !== option.name),
    );
    const fallback = variants.find((variant) => matchesSelection(variant, partial));
    if (fallback) next[option.name] = fallback.attributes[option.name];
  }

  return next;
}
