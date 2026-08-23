const VN_MOBILE_REGEX = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s.\-()]/g, '');
}

/** Vietnamese mobile — required + format. Returns normalized 0xxxxxxxxx. */
export function validateVnPhone(phone: string | null | undefined, fieldLabel = 'Số điện thoại'): string {
  if (!phone || !phone.trim()) {
    throw new Error(`${fieldLabel} là bắt buộc.`);
  }

  const normalized = normalizePhone(phone);
  if (!VN_MOBILE_REGEX.test(normalized)) {
    throw new Error(`${fieldLabel} không hợp lệ. Ví dụ: 0912345678`);
  }

  return normalized.startsWith('+84') ? `0${normalized.slice(3)}` : normalized;
}

export function validateRequired(value: string | null | undefined, fieldLabel: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new Error(`${fieldLabel} là bắt buộc.`);
  }
  return trimmed;
}
