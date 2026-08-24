export const SELLER_REGISTRATION_MAX_ADMIN_NOTE = 500;

export function validateSellerRejectNote(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Admin note is required when rejecting a seller registration.');
  }
  if (trimmed.length > SELLER_REGISTRATION_MAX_ADMIN_NOTE) {
    throw new Error(`Admin note must not exceed ${SELLER_REGISTRATION_MAX_ADMIN_NOTE} characters.`);
  }
}
