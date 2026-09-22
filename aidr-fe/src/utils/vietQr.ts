/**
 * Build a VietQR image URL for Napas 24/7 bank transfers.
 * Uses the public img.vietqr.io CDN (BIN or bank code + account number).
 * @see https://www.vietqr.io/en/documentation/
 */

export type VietQrImageParams = {
  /** Napas bank BIN (e.g. 970422) or bank code (e.g. MB). */
  bankId: string;
  accountNumber: string;
  accountName?: string | null;
  /** Integer VND amount (fractional part is dropped). */
  amount?: number | null;
  /** Transfer description (VietQR truncates long addInfo). */
  addInfo?: string | null;
  /** Image template: compact | print | qr_only */
  template?: 'compact2' | 'compact' | 'qr_only' | 'print';
};

const MAX_ADD_INFO = 25;

/** Strip accents / non-ASCII so banking apps accept the transfer note. */
export function sanitizeVietQrAddInfo(raw: string, maxLen = MAX_ADD_INFO): string {
  const ascii = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ascii.slice(0, maxLen);
}

export function buildVietQrImageUrl(params: VietQrImageParams): string | null {
  const bankId = params.bankId?.trim();
  const accountNumber = params.accountNumber?.replace(/\s+/g, '').trim();
  if (!bankId || !accountNumber) return null;

  const template = params.template ?? 'compact2';
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNumber)}-${template}.png`;

  const query = new URLSearchParams();
  if (params.amount != null && Number.isFinite(params.amount) && params.amount > 0) {
    query.set('amount', String(Math.round(params.amount)));
  }
  if (params.addInfo?.trim()) {
    query.set('addInfo', sanitizeVietQrAddInfo(params.addInfo.trim()));
  }
  if (params.accountName?.trim()) {
    query.set('accountName', params.accountName.trim().toUpperCase());
  }

  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildRefundTransferNote(orderCode: string): string {
  const code = orderCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  return sanitizeVietQrAddInfo(`AIDR refund ${code}`);
}
