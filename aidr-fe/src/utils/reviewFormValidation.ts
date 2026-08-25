import { tryValidateField } from './formValidation';

export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;
export const REVIEW_MAX_TITLE = 150;
export const REVIEW_MAX_CONTENT = 2000;
export const REVIEW_MAX_SELLER_COMMENT = 1000;

export type ProductReviewFormValues = {
  rating: number;
  title: string;
  content: string;
};

export type SellerRatingFormValues = {
  score: number;
  comment: string;
};

export type ProductReviewFormField = keyof ProductReviewFormValues;
export type SellerRatingFormField = keyof SellerRatingFormValues;

function validateRating(rating: number, label = 'Rating'): void {
  if (!Number.isFinite(rating) || rating < REVIEW_MIN_RATING || rating > REVIEW_MAX_RATING) {
    throw new Error(`${label} must be between ${REVIEW_MIN_RATING} and ${REVIEW_MAX_RATING}.`);
  }
}

function validateContent(content: string): void {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Review content is required.');
  if (trimmed.length > REVIEW_MAX_CONTENT) {
    throw new Error(`Review content must not exceed ${REVIEW_MAX_CONTENT} characters.`);
  }
}

function validateTitle(title: string): void {
  const trimmed = title.trim();
  if (trimmed.length > REVIEW_MAX_TITLE) {
    throw new Error(`Review title must not exceed ${REVIEW_MAX_TITLE} characters.`);
  }
}

function validateSellerComment(comment: string): void {
  const trimmed = comment.trim();
  if (trimmed.length > REVIEW_MAX_SELLER_COMMENT) {
    throw new Error(`Comment must not exceed ${REVIEW_MAX_SELLER_COMMENT} characters.`);
  }
}

export function validateProductReviewForm(form: ProductReviewFormValues) {
  const errors: Partial<Record<ProductReviewFormField, string>> = {};

  const ratingError = tryValidateField(() => validateRating(form.rating));
  if (ratingError) errors.rating = ratingError;

  const contentError = tryValidateField(() => validateContent(form.content));
  if (contentError) errors.content = contentError;

  const titleError = tryValidateField(() => validateTitle(form.title));
  if (titleError) errors.title = titleError;

  return errors;
}

export function validateSellerRatingForm(form: SellerRatingFormValues) {
  const errors: Partial<Record<SellerRatingFormField, string>> = {};

  const scoreError = tryValidateField(() => validateRating(form.score, 'Score'));
  if (scoreError) errors.score = scoreError;

  const commentError = tryValidateField(() => validateSellerComment(form.comment));
  if (commentError) errors.comment = commentError;

  return errors;
}

export function canSubmitProductReviewForm(
  form: ProductReviewFormValues,
  errors: Partial<Record<ProductReviewFormField, string>>,
) {
  if (Object.keys(errors).length > 0) return false;
  if (form.rating < REVIEW_MIN_RATING) return false;
  if (!form.content.trim()) return false;
  return Object.keys(validateProductReviewForm(form)).length === 0;
}

export function canSubmitSellerRatingForm(
  form: SellerRatingFormValues,
  errors: Partial<Record<SellerRatingFormField, string>>,
) {
  if (Object.keys(errors).length > 0) return false;
  if (form.score < REVIEW_MIN_RATING) return false;
  return Object.keys(validateSellerRatingForm(form)).length === 0;
}
