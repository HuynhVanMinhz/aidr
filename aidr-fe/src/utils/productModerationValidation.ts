export const PRODUCT_MODERATION_MAX_REASON = 500;

export function validateProductRejectReason(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Reason is required when rejecting a product.');
  }
  if (trimmed.length > PRODUCT_MODERATION_MAX_REASON) {
    throw new Error(`Reason must not exceed ${PRODUCT_MODERATION_MAX_REASON} characters.`);
  }
}
