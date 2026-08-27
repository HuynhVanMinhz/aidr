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
const HELPFUL_STORAGE_PREFIX = 'aidr.review.helpful.';

type Props = {
  productId: string;
  active?: boolean;
};

function readHelpfulCount(reviewId: string): number {
  try {
    const raw = localStorage.getItem(`${HELPFUL_STORAGE_PREFIX}${reviewId}`);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeHelpfulCount(reviewId: string, count: number) {
  try {
    localStorage.setItem(`${HELPFUL_STORAGE_PREFIX}${reviewId}`, String(count));
  } catch {
    /* ignore quota / private mode */
  }
}

function readHelpfulVoted(reviewId: string): boolean {
  try {
    return localStorage.getItem(`${HELPFUL_STORAGE_PREFIX}${reviewId}.voted`) === '1';
  } catch {
    return false;
  }
}

function writeHelpfulVoted(reviewId: string) {
  try {
    localStorage.setItem(`${HELPFUL_STORAGE_PREFIX}${reviewId}.voted`, '1');
  } catch {
    /* ignore */
  }
}

function ratingCountFor(breakdown: number[] | null | undefined, star: number): number {
  if (!breakdown || star < 1 || star > 5) return 0;
  return breakdown[star - 1] ?? 0;
}

function displayReviewTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  return title.replace(/^REV-SEED:\s*/i, '').trim() || null;
}

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
  const [helpfulCount, setHelpfulCount] = useState(() => readHelpfulCount(review.reviewId));
  const [helpfulVoted, setHelpfulVoted] = useState(() => readHelpfulVoted(review.reviewId));

  const errors = useMemo(() => validateProductReviewForm(form), [form]);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSave = canSubmitProductReviewForm(form, errors);
  const isVerified = true; // AIDR only accepts reviews after a completed purchase
  const title = displayReviewTitle(review.title);

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

  function handleHelpful() {
    if (helpfulVoted) return;
    const next = helpfulCount + 1;
    setHelpfulCount(next);
    setHelpfulVoted(true);
    writeHelpfulCount(review.reviewId, next);
    writeHelpfulVoted(review.reviewId);
  }

  const avatar = review.buyerAvatarUrl ? (
    <img src={review.buyerAvatarUrl} alt="" />
  ) : (
    <span>{review.buyerName.charAt(0).toUpperCase()}</span>
  );

  if (editing) {
    return (
      <div className="customer-review-item customer-review-item--editing catalog-review-card">
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
    <article className="customer-review-item catalog-review-card">
      <div className="icon-box catalog-review-avatar">{avatar}</div>
      <div className="customer-review-item-body">
        <div className="catalog-review-card__meta">
          <div className="catalog-review-card__author">
            <span className="catalog-review-card__name">{review.buyerName}</span>
            <time className="catalog-review-card__date" dateTime={review.createdAt}>
              {formatDateVi(review.createdAt)}
            </time>
          </div>
          <div className="catalog-review-card__badges">
            {isVerified ? (
              <span className="catalog-review-badge catalog-review-badge--verified">
                Verified Purchase
              </span>
            ) : null}
            <StarRatingDisplay rating={review.rating} />
          </div>
        </div>

        <div className="customer-review-item-content catalog-review-card__content">
          {title ? <h4 className="catalog-review-card__title">{title}</h4> : null}
          {review.content ? <p>{review.content}</p> : null}
          {review.sentimentLabel ? (
            <p className="review-sentiment-label">Sentiment: {review.sentimentLabel}</p>
          ) : null}
        </div>

        <div className="catalog-review-card__footer">
          <p className="catalog-review-helpful-text">
            {helpfulCount > 0
              ? `${helpfulCount} ${helpfulCount === 1 ? 'person' : 'people'} found this helpful`
              : 'Was this review helpful?'}
          </p>
          <button
            type="button"
            className={`catalog-review-helpful-btn${helpfulVoted ? ' is-voted' : ''}`}
            disabled={helpfulVoted}
            onClick={handleHelpful}
          >
            {helpfulVoted ? 'Marked helpful' : 'Helpful'}
          </button>
        </div>

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
    </article>
  );
}

export function ProductReviewsPanel({ productId, active = true }: Props) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const query = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, rating: ratingFilter }),
    [page, ratingFilter],
  );

  const { list, loading, mutating, editReview, removeReview, getErrorMessage } = useProductReviews(
    productId,
    query,
    { autoLoad: active },
  );

  const items = list?.items ?? [];
  const totalPages = list?.totalPages ?? 0;
  const avgRating = list?.avgRating ?? 0;
  const ratingBreakdown = list?.ratingBreakdown ?? [];
  const reviewCount =
    ratingBreakdown.length > 0
      ? ratingBreakdown.reduce((sum, n) => sum + (Number(n) || 0), 0)
      : (list?.reviewCount ?? 0);

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
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to remove review.'));
    }
  }

  function handleRatingChip(value: number | null) {
    setRatingFilter(value);
    setPage(1);
  }

  return (
    <div className="product-review-form-content catalog-review-layout">
      <aside className="catalog-review-sidebar">
        <div className="catalog-detail-review-summary">
          <p className="catalog-review-summary__score">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</p>
          <StarRatingDisplay rating={avgRating} />
          <p className="catalog-review-summary__count">
            Based on {reviewCount} review{reviewCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="catalog-review-distribution" aria-label="Rating distribution">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingCountFor(ratingBreakdown, star);
            const pct = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;
            return (
              <button
                key={star}
                type="button"
                className={`catalog-review-distribution__row${ratingFilter === star ? ' is-active' : ''}`}
                onClick={() => handleRatingChip(ratingFilter === star ? null : star)}
                aria-pressed={ratingFilter === star}
                aria-label={`Filter ${star} star reviews, ${count} total`}
              >
                <span className="catalog-review-distribution__label">{star}★</span>
                <span className="catalog-review-distribution__bar" aria-hidden>
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="catalog-review-distribution__count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="catalog-review-chips" role="group" aria-label="Filter by rating">
          <button
            type="button"
            className={`catalog-review-chip${ratingFilter == null ? ' is-active' : ''}`}
            onClick={() => handleRatingChip(null)}
          >
            All
          </button>
          {[5, 4, 3, 2, 1].map((star) => (
            <button
              key={star}
              type="button"
              className={`catalog-review-chip${ratingFilter === star ? ' is-active' : ''}`}
              onClick={() => handleRatingChip(ratingFilter === star ? null : star)}
            >
              {star}★
            </button>
          ))}
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
      </aside>

      <div className="catalog-review-main">
        {loading && items.length === 0 ? <p className="account-muted">Loading reviews…</p> : null}

        <div className="customer-review-list catalog-review-list">
          {!loading && items.length === 0 ? (
            <p className="catalog-review-empty">
              {ratingFilter != null
                ? `No ${ratingFilter}-star reviews yet.`
                : 'No reviews yet. Be the first to share your experience after purchase.'}
            </p>
          ) : null}
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
    </div>
  );
}
