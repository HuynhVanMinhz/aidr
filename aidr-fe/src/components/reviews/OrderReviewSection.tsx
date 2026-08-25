import { useMemo, useState, type FormEvent } from 'react';
import { useProductReviews, useSellerRatingSubmit } from '../../hooks/useProductReviews';
import { useToast } from '../../hooks/useToast';
import type { BuyerOrderItem } from '../../types/order';
import { visibleFieldErrors } from '../../utils/formValidation';
import {
  canSubmitProductReviewForm,
  canSubmitSellerRatingForm,
  type ProductReviewFormField,
  type ProductReviewFormValues,
  REVIEW_MAX_CONTENT,
  REVIEW_MAX_SELLER_COMMENT,
  REVIEW_MAX_TITLE,
  type SellerRatingFormField,
  validateProductReviewForm,
  validateSellerRatingForm,
} from '../../utils/reviewFormValidation';
import { StarRatingInput } from './StarRatingInput';

type ProductReviewCreateFormProps = {
  productId: string;
  productName: string;
  orderId: string;
  onSubmitted?: () => void;
};

export function ProductReviewCreateForm({
  productId,
  productName,
  orderId,
  onSubmitted,
}: ProductReviewCreateFormProps) {
  const toast = useToast();
  const { submitReview, mutating, getErrorMessage } = useProductReviews(productId, undefined, {
    autoLoad: false,
  });

  const [submittedOk, setSubmittedOk] = useState(false);
  const [form, setForm] = useState<ProductReviewFormValues>({
    rating: 0,
    title: '',
    content: '',
  });
  const [touched, setTouched] = useState<Partial<Record<ProductReviewFormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validateProductReviewForm(form), [form]);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSubmit = canSubmitProductReviewForm(form, errors);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;

    try {
      await submitReview({
        orderId,
        rating: form.rating,
        title: form.title.trim() || null,
        content: form.content.trim(),
      });
      toast.success('Review submitted.');
      setSubmittedOk(true);
      onSubmitted?.();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to submit review.'));
    }
  }

  if (submittedOk) {
    return (
      <div className="order-review-card order-review-card--done">
        <p>
          Review submitted for <strong>{productName}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="order-review-card">
      <h3>Review {productName}</h3>
      <form className="review-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-group">
          <label>Your rating</label>
          <StarRatingInput
            value={form.rating}
            onChange={(rating) => {
              setForm((current) => ({ ...current, rating }));
              setTouched((current) => ({ ...current, rating: true }));
            }}
            disabled={mutating}
          />
          {visible.rating ? <p className="form-field-error">{visible.rating}</p> : null}
        </div>
        <div className="form-group">
          <label htmlFor={`create-review-title-${productId}`}>Title (optional)</label>
          <input
            id={`create-review-title-${productId}`}
            className="form-control"
            maxLength={REVIEW_MAX_TITLE}
            value={form.title}
            disabled={mutating}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, title: true }))}
          />
          {visible.title ? <p className="form-field-error">{visible.title}</p> : null}
        </div>
        <div className="form-group">
          <label htmlFor={`create-review-content-${productId}`}>Review</label>
          <textarea
            id={`create-review-content-${productId}`}
            className="form-control"
            rows={4}
            maxLength={REVIEW_MAX_CONTENT}
            value={form.content}
            disabled={mutating}
            placeholder="Share your experience with this product"
            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, content: true }))}
          />
          {visible.content ? <p className="form-field-error">{visible.content}</p> : null}
        </div>
        <button type="submit" className="btn-default btn-accent" disabled={!canSubmit || mutating}>
          {mutating ? 'Submitting…' : 'Submit review'}
        </button>
      </form>
    </div>
  );
}

function SellerRatingCreateForm({
  orderId,
  shopId,
  shopName,
}: {
  orderId: string;
  shopId: string;
  shopName: string;
}) {
  const toast = useToast();
  const { submitRating, mutating, getErrorMessage } = useSellerRatingSubmit();

  const [submittedOk, setSubmittedOk] = useState(false);
  const [form, setForm] = useState({ score: 0, comment: '' });
  const [touched, setTouched] = useState<Partial<Record<SellerRatingFormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validateSellerRatingForm(form), [form]);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSubmit = canSubmitSellerRatingForm(form, errors);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;

    try {
      await submitRating({
        shopId,
        orderId,
        score: form.score,
        comment: form.comment.trim() || null,
      });
      toast.success('Seller rating submitted.');
      setSubmittedOk(true);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to submit seller rating.'));
    }
  }

  if (submittedOk) {
    return (
      <div className="order-review-card order-review-card--done">
        <p>
          Thank you for rating <strong>{shopName}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="order-review-card">
      <h3>Rate {shopName}</h3>
      <form className="review-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-group">
          <label>Your score</label>
          <StarRatingInput
            value={form.score}
            label="Score"
            onChange={(score) => {
              setForm((current) => ({ ...current, score }));
              setTouched((current) => ({ ...current, score: true }));
            }}
            disabled={mutating}
          />
          {visible.score ? <p className="form-field-error">{visible.score}</p> : null}
        </div>
        <div className="form-group">
          <label htmlFor="seller-rating-comment">Comment (optional)</label>
          <textarea
            id="seller-rating-comment"
            className="form-control"
            rows={3}
            maxLength={REVIEW_MAX_SELLER_COMMENT}
            value={form.comment}
            disabled={mutating}
            placeholder="Tell others about your experience with this shop"
            onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, comment: true }))}
          />
          {visible.comment ? <p className="form-field-error">{visible.comment}</p> : null}
        </div>
        <button type="submit" className="btn-default btn-accent" disabled={!canSubmit || mutating}>
          {mutating ? 'Submitting…' : 'Submit seller rating'}
        </button>
      </form>
    </div>
  );
}

type OrderReviewSectionProps = {
  orderId: string;
  shopId: string;
  shopName: string;
  items: BuyerOrderItem[];
};

export function OrderReviewSection({ orderId, shopId, shopName, items }: OrderReviewSectionProps) {
  return (
    <div className="order-review-section">
      <h2>Reviews & ratings</h2>
      <p className="account-muted">
        Share feedback for products in this order and rate {shopName}.
      </p>

      <SellerRatingCreateForm orderId={orderId} shopId={shopId} shopName={shopName} />

      <div className="order-product-review-list">
        {items.map((item) => (
          <ProductReviewCreateForm
            key={item.orderItemId}
            productId={item.productId}
            productName={item.productName}
            orderId={orderId}
          />
        ))}
      </div>
    </div>
  );
}
