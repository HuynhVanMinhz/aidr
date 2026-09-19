const VN_MOBILE_REGEX = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s.\-()]/g, '');
}

/** Vietnamese mobile - required + format. Returns normalized 0xxxxxxxxx. */
export function validateVnPhone(phone: string | null | undefined, fieldLabel = 'Phone number'): string {
  if (!phone || !phone.trim()) {
    throw new Error(`${fieldLabel} is required.`);
  }

  const normalized = normalizePhone(phone);
  if (!VN_MOBILE_REGEX.test(normalized)) {
    throw new Error(`${fieldLabel} is invalid. Example: 0912345678`);
  }

  return normalized.startsWith('+84') ? `0${normalized.slice(3)}` : normalized;
}

export function validateRequired(value: string | null | undefined, fieldLabel: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new Error(`${fieldLabel} is required.`);
  }
  return trimmed;
}

export function validateMaxLength(value: string, maxLength: number, fieldLabel: string): string {
  if (value.length > maxLength) {
    throw new Error(`${fieldLabel} must not exceed ${maxLength} characters.`);
  }
  return value;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateSlug(value: string | null | undefined, maxLength: number): string {
  const trimmed = validateRequired(value, 'Slug').toLowerCase();
  validateMaxLength(trimmed, maxLength, 'Slug');
  if (!SLUG_REGEX.test(trimmed)) {
    throw new Error('Slug may contain only lowercase letters, numbers, and hyphens.');
  }
  return trimmed;
}

const HTTP_URL_REGEX = /^https?:\/\/.+\..+/i;

export function validateOptionalImageUrl(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  validateMaxLength(trimmed, maxLength, 'Image URL');
  const isRelative = trimmed.startsWith('/');
  if (!isRelative && !HTTP_URL_REGEX.test(trimmed)) {
    throw new Error('Image URL is invalid.');
  }
  return trimmed;
}

/** Required image URL - http/https or a relative path. */
export function validateImageUrl(value: string | null | undefined, maxLength: number): string {
  const trimmed = validateRequired(value, 'Image URL');
  validateMaxLength(trimmed, maxLength, 'Image URL');
  const isRelative = trimmed.startsWith('/');
  if (!isRelative && !HTTP_URL_REGEX.test(trimmed)) {
    throw new Error('Image URL is invalid.');
  }
  return trimmed;
}

export function slugFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}
