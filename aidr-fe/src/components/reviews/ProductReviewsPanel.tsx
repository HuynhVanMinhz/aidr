import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProductReviews } from '../../hooks/useProductReviews';
import { useToast } from '../../hooks/useToast';
import type { ProductReview } from '../../types/review';
import { formatDateVi } from '../../utils/formatCatalog';
import { visibleFieldErrors } from '../../utils/formValidation';
import {
  canSubmitProductReviewForm,
  type ProductReviewFormField,
  type ProductReviewFormValues,
  REVIEW_MAX_CONTENT,
  REVIEW_MAX_TITLE,
  validateProductReviewForm,
} from '../../utils/reviewFormValidation';
import { StarRatingDisplay, StarRatingInput } from './StarRatingInput';

const PAGE_SIZE = 10;

type Props = {
  productId: string;
  soldCount?: number;
  active?: boolean;
};

function ReviewItem({
  review,
  mutating,
  onEdit,
  onDelete,
}: {
  review: ProductReview;
  mutating: boolean;
  onEdit: (reviewId: string, values: ProductReviewFormValues) => Promise<void>;
  onDelete: (reviewId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProductReviewFormValues>({
    rating: review.rating,
    title: review.title ?? '',
    content: review.content ?? '',
  });
  const [touched, setTouched] = useState<Partial<Record<ProductReviewFormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validateProductReviewForm(form), [form]);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSave = canSubmitProductReviewForm(form, errors);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSave) return;

    await onEdit(review.reviewId, form);
    setEditing(false);
    setSubmitted(false);
    setTouched({});
  }

  async function handleDelete() {
    const confirmed = window.confirm('Remove this review from the product page?');
    if (!confirmed) return;
    await onDelete(review.reviewId);
  }

  const avatar = review.buyerAvatarUrl ? (
    <img src={review.buyerAvatarUrl} alt="" />
  ) : (
    <span>{review.buyerName.charAt(0).toUpperCase()}</span>
  );

  if (editing) {
    return (
      <div className="customer-review-item customer-review-item--editing">
        <form className="review-form" onSubmit={(event) => void handleSave(event)}>
          <div className="form-group">
            <label>Rating</label>
            <StarRatingInput
              value={form.rating}
              onChange={(rating) => setForm((current) => ({ ...current, rating }))}
              disabled={mutating}
            />
            {visible.rating ? <p className="form-field-error">{visible.rating}</p> : null}
          </div>
          <div className="form-group">
            <label htmlFor={`review-title-${review.reviewId}`}>Title (optional)</label>
            <input
              id={`review-title-${review.reviewId}`}
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
            <label htmlFor={`review-content-${review.reviewId}`}>Review</label>
            <textarea
              id={`review-content-${review.reviewId}`}
              className="form-control"
              rows={4}
              maxLength={REVIEW_MAX_CONTENT}
              value={form.content}
              disabled={mutating}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              onBlur={() => setTouched((current) => ({ ...current, content: true }))}
            />
            {visible.content ? <p className="form-field-error">{visible.content}</p> : null}
          </div>
          <div className="review-item-actions">
            <button type="submit" className="btn-default btn-accent" disabled={!canSave || mutating}>
              {mutating ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="btn-default btn-accent btn-border"
              disabled={mutating}
              onClick={() => {
                setEditing(false);
                setForm({
                  rating: review.rating,
                  title: review.title ?? '',
                  content: review.content ?? '',
                });
                setSubmitted(false);
                setTouched({});
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="customer-review-item">
      <div className="icon-box catalog-review-avatar">{avatar}</div>
      <div className="customer-review-item-body">
        <div className="customer-review-item-content">
          <p>
            <span>{review.buyerName}</span> — {formatDateVi(review.createdAt)}
          </p>
          {review.title ? (
            <p>
              <strong>{review.title}</strong>
            </p>
          ) : null}
          {review.content ? <p>{review.content}</p> : null}
          {review.sentimentLabel ? (
            <p className="review-sentiment-label">Sentiment: {review.sentimentLabel}</p>
          ) : null}
        </div>
        <StarRatingDisplay rating={review.rating} />
        {review.isOwn ? (
          <div className="review-item-actions">
            {review.canEdit ? (
              <button
                type="button"
                className="btn-default btn-accent btn-border"
                disabled={mutating}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              className="btn-default btn-accent btn-border"
              disabled={mutating}
              onClick={() => void handleDelete()}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductReviewsPanel({ productId, soldCount = 0, active = true }: Props) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const query = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, rating: ratingFilter }),
    [page, ratingFilter],
  );

  const { list, loading, mutating, refresh, editReview, removeReview, getErrorMessage } =
    useProductReviews(productId, query, { autoLoad: active });

  const items = list?.items ?? [];
  const totalPages = list?.totalPages ?? 0;
  const avgRating = list?.avgRating ?? 0;
  const reviewCount = list?.reviewCount ?? 0;

  async function handleEdit(reviewId: string, values: ProductReviewFormValues) {
    try {
      await editReview(reviewId, {
        rating: values.rating,
        title: values.title.trim() || null,
        content: values.content.trim(),
      });
      toast.success('Review updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update review.'));
      throw error;
    }
  }

  async function handleDelete(reviewId: string) {
    try {
      await removeReview(reviewId);
      toast.success('Review removed.');
      if (items.length <= 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await refresh();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to remove review.'));
    }
  }

  function handleRatingFilterChange(value: string) {
    setRatingFilter(value ? Number(value) : null);
    setPage(1);
  }

  return (
    <div className="product-review-form-content">
      <div className="catalog-detail-review-summary">
        <StarRatingDisplay rating={avgRating} />
        <p>
          {reviewCount} review{reviewCount === 1 ? '' : 's'}
          {soldCount > 0 ? ` · ${soldCount} sold` : ''}
        </p>
      </div>

      <div className="review-list-toolbar">
        <div className="review-list-filter">
          <label htmlFor="review-rating-filter">Filter by rating</label>
          <select
            id="review-rating-filter"
            className="form-control"
            value={ratingFilter ?? ''}
            onChange={(event) => handleRatingFilterChange(event.target.value)}
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} star{rating === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-default btn-accent btn-border"
          disabled={loading}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>

      {isAuthenticated ? (
        <p className="review-order-hint account-muted">
          Purchased this product? Leave a review from your{' '}
          <Link to="/account/orders">completed order</Link>.
        </p>
      ) : (
        <p className="review-order-hint account-muted">
          <Link to="/login">Sign in</Link> to review products after a completed purchase.
        </p>
      )}

      {loading && items.length === 0 ? <p className="account-muted">Loading reviews…</p> : null}

      <div className="customer-review-list">
        {!loading && items.length === 0 ? <p>No reviews yet.</p> : null}
        {items.map((review) => (
          <ReviewItem
            key={review.reviewId}
            review={review}
            mutating={mutating}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="buyer-orders-pagination">
          <button
            type="button"
            className="btn-default btn-accent btn-border"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-default btn-accent btn-border"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
