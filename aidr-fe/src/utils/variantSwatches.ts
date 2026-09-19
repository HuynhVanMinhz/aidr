import type { ProductVariantOption } from '../types/catalog';

/**
 * Deciding whether an option axis can be drawn as colour swatches.
 *
 * The theme ships four hard-coded swatch classes (black / red / gray / light), but a seller
 * types whatever colour name they like, in English or Vietnamese. So the class is replaced
 * with a looked-up background, and anything not in the table falls back to the labelled pill
 * style - a blank circle the shopper cannot name is worse than plain text.
 */

/** Lower-cases and strips Vietnamese diacritics so "Đen", "den" and "ĐEN" all match. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // đ/Đ carries its stroke in the base glyph, so NFD leaves it untouched.
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

const COLOR_AXIS_NAMES = new Set(['color', 'colour', 'mau', 'mau sac']);

const SWATCHES: Record<string, string> = {
  // Neutrals
  black: '#16181D',
  den: '#16181D',
  white: '#FFFFFF',
  trang: '#FFFFFF',
  gray: '#707070',
  grey: '#707070',
  xam: '#707070',
  'space gray': '#4A4A4C',
  'space grey': '#4A4A4C',
  graphite: '#3A3D42',
  silver: '#C8CCD0',
  bac: '#C8CCD0',
  titanium: '#8E8E93',
  titan: '#8E8E93',

  // Colours
  red: '#E65757',
  do: '#E65757',
  blue: '#1E5EFF',
  'xanh duong': '#1E5EFF',
  'xanh da troi': '#1E5EFF',
  'midnight blue': '#17275B',
  'xanh dem': '#17275B',
  navy: '#0B1F45',
  green: '#2FA84F',
  'xanh la': '#2FA84F',
  'xanh luc': '#2FA84F',
  mint: '#A8E6CF',
  yellow: '#F5C518',
  vang: '#F5C518',
  gold: '#C9A227',
  'vang dong': '#C9A227',
  orange: '#F2762E',
  cam: '#F2762E',
  pink: '#F2739F',
  hong: '#F2739F',
  'rose gold': '#E6B5A8',
  'vang hong': '#E6B5A8',
  purple: '#7B4BC9',
  tim: '#7B4BC9',
  brown: '#7B5233',
  nau: '#7B5233',
  beige: '#E8D9C5',
  be: '#E8D9C5',
  cream: '#F5EFE0',
  kem: '#F5EFE0',
};

export function swatchColor(value: string): string | null {
  return SWATCHES[normalize(value)] ?? null;
}

/*
 * There is deliberately no "is this colour pale?" helper here. A swatch disappears whenever
 * it approaches the page behind it, and that page is white in light mode and near-black in
 * dark mode - so White vanishes in one and Black in the other. A luma test only ever catches
 * one of the two. The swatch outline is drawn in CSS from --divider-color instead, which
 * already flips with the theme.
 */

/**
 * An axis renders as swatches only when it is a colour axis *and* every one of its values
 * is known. A half-and-half row of circles and words reads as a bug.
 */
export function isSwatchAxis(option: ProductVariantOption): boolean {
  if (!COLOR_AXIS_NAMES.has(normalize(option.name))) return false;
  return option.values.length > 0 && option.values.every((v) => swatchColor(v) !== null);
}
