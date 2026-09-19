export function formatMoney(amount: number, currency = 'VND'): string {
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('vi-VN')} ${currency}`;
  }
}

export function discountPercent(basePrice: number, salePrice?: number | null): number | null {
  if (salePrice == null || salePrice <= 0 || salePrice >= basePrice) return null;
  return Math.round(((basePrice - salePrice) / basePrice) * 100);
}

export function parseSpecsJson(raw?: string | null): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value == null) continue;
      result[key] = String(value);
    }
    return result;
  } catch {
    return {};
  }
}

export function parseTagsJson(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((tag) => String(tag)).filter(Boolean);
  } catch {
    return [];
  }
}

export function formatDateVi(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
