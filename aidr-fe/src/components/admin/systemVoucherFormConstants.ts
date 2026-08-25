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
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export function emptySystemVoucherForm(
  overrides?: Partial<SystemVoucherFormValues>,
): SystemVoucherFormValues {
  const now = new Date();
  const start = new Date(now.getTime());
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
    startsAt: toDatetimeLocalValue(start),
    endsAt: toDatetimeLocalValue(end),
    isActive: true,
    ...overrides,
  };
}

export function toDatetimeLocalValue(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date.');
  return d.toISOString();
}
