export const VOUCHER_MAX_CODE = 40;
export const VOUCHER_MAX_NAME = 150;
export const VOUCHER_MAX_DESCRIPTION = 500;
export const VOUCHER_MIN_PER_USER = 1;
export const VOUCHER_MAX_PER_USER = 1000;

export type SystemVoucherFormValues = {
  code: string;
  name: string;
  description: string;
  discountType: 'Percent' | 'FixedAmount';
  discountValue: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  usageLimit: string;
  perUserLimit: string;
  /** Local datetime `yyyy-MM-ddTHH:mm` (AdminDatePicker enableTime). */
  startsAt: string;
  /** Local datetime `yyyy-MM-ddTHH:mm` (AdminDatePicker enableTime). */
  endsAt: string;
  isActive: boolean;
};

export function emptySystemVoucherForm(
  overrides?: Partial<SystemVoucherFormValues>,
): SystemVoucherFormValues {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    code: '',
    name: '',
    description: '',
    discountType: 'Percent',
    discountValue: '10',
    maxDiscountAmount: '',
    minOrderAmount: '0',
    usageLimit: '',
    perUserLimit: '1',
    startsAt: toDatetimeLocalValue(now),
    endsAt: toDatetimeLocalValue(end),
    isActive: true,
    ...overrides,
  };
}

/** Local datetime → `yyyy-MM-ddTHH:mm` for AdminDatePicker (enableTime). */
export function toDatetimeLocalValue(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local `yyyy-MM-ddTHH:mm` → UTC ISO for API. */
export function fromDatetimeLocalValue(local: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match) throw new Error('Invalid date.');
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const hh = Number(match[4]);
  const mm = Number(match[5]);
  const date = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date.');
  return date.toISOString();
}
