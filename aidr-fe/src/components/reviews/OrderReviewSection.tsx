import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useProductReviews, useSellerRatingSubmit } from '../../hooks/useProductReviews';
import { useToast } from '../../hooks/useToast';
import type { BuyerOrderItem } from '../../types/order';
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from '../../utils/catalogImage';
import { visibleFieldErrors } from '../../utils/formValidation';
import { formatMoney } from '../../utils/formatCatalog';
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

function StepHead({
  step,
  title,
  hint,
  done,
}: {
  step: number;
  title: string;
  hint: string;
  done?: boolean;
}) {
  return (
    <div className={`order-review__step${done ? ' is-done' : ''}`}>
      <span className="order-review__step-badge" aria-hidden>
        {done ? '✓' : step}
      </span>
      <div className="order-review__step-copy">
        <h4 className="order-review__step-title">{title}</h4>
        <p className="account-muted">{hint}</p>
      </div>
    </div>
  );
}

function ReviewDone({ children }: { children: ReactNode }) {
  return (
    <div className="order-review__done" role="status">
      <i className="fa-solid fa-circle-check" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.9;
  return (
    <span className={`order-review__count${near ? ' is-near' : ''}`}>
      {value.length} / {max}
    </span>
  );
}

function ItemHead({
  item,
  currency,
  index,
}: {
  item: BuyerOrderItem;
  currency: string;
  index: number;
}) {
  return (
    <div className="order-line order-review__item-head">
      <Link to={`/products/${item.productId}`} className="order-line__thumb">
        <img
          src={resolveProductImageUrl(item.imageUrl, index ?? 0)}
          alt=""
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallback === '1') return;
            img.dataset.fallback = '1';
            img.src = PRODUCT_IMAGE_PLACEHOLDER;
          }}
        />
      </Link>
      <div className="order-line__info">
        <Link to={`/products/${item.productId}`} className="order-line__name">
          {item.productName}
        </Link>
        <p className="order-line__meta">
          {item.sku ? <span>{item.sku}</span> : null}
          <span>Qty {item.quantity}</span>
          {currency ? <span>{formatMoney(item.unitPrice, currency)} each</span> : null}
        </p>
      </div>
    </div>
  );
}

type ProductReviewCreateFormProps = {
  item: BuyerOrderItem;
  currency: string;
  orderId: string;
  index: number;
  onSubmitted?: () => void;
};

export function ProductReviewCreateForm({
  item,
  currency,
  orderId,
  index,
  onSubmitted,
}: ProductReviewCreateFormProps) {
  const toast = useToast();
  const { submitReview, mutating, getErrorMessage } = useProductReviews(item.productId, undefined, {
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
      <li className="order-review__item">
        <ItemHead item={item} currency={currency} index={index} />
        <ReviewDone>
          Your review of <strong>{item.productName}</strong> is live. Thanks for helping other
          buyers decide.
        </ReviewDone>
      </li>
    );
  }

  return (
    <li className="order-review__item">
      <ItemHead item={item} currency={currency} index={index} />

      <form className="order-review__form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-group">
          <label>Rating</label>
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
          <label htmlFor={`create-review-title-${item.productId}`}>
            Title <span className="order-review__optional">Optional</span>
          </label>
          <input
            id={`create-review-title-${item.productId}`}
            className="form-control"
            maxLength={REVIEW_MAX_TITLE}
            value={form.title}
            disabled={mutating}
            placeholder="e.g. Battery lasts two full days"
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, title: true }))}
          />
          {visible.title ? <p className="form-field-error">{visible.title}</p> : null}
        </div>

        <div className="form-group">
          <label htmlFor={`create-review-content-${item.productId}`}>Your review</label>
          <textarea
            id={`create-review-content-${item.productId}`}
            className="form-control"
            rows={4}
            maxLength={REVIEW_MAX_CONTENT}
            value={form.content}
            disabled={mutating}
            placeholder="What stood out? Build quality, battery, performance - anything that would have helped you before buying."
            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, content: true }))}
          />
          <div className="order-review__field-footer">
            <CharCount value={form.content} max={REVIEW_MAX_CONTENT} />
          </div>
          {visible.content ? <p className="form-field-error">{visible.content}</p> : null}
        </div>

        <div className="order-review__actions">
          <button
            type="submit"
            className="account-btn account-btn--primary"
            disabled={!canSubmit || mutating}
          >
            {mutating ? 'Submitting…' : 'Submit review'}
          </button>
          {!canSubmit && !mutating ? (
            <span className="account-muted order-review__hint">
              {form.rating === 0 ? 'Pick a star rating first.' : 'Write a few words to continue.'}
            </span>
          ) : null}
        </div>
      </form>
    </li>
  );
}

function SellerRatingCreateForm({
  orderId,
  shopId,
  shopName,
  onSubmitted,
}: {
  orderId: string;
  shopId: string;
  shopName: string;
  onSubmitted?: () => void;
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
      onSubmitted?.();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to submit seller rating.'));
    }
  }

  if (submittedOk) {
    return (
      <ReviewDone>
        Thanks - your rating for <strong>{shopName}</strong> has been recorded.
      </ReviewDone>
    );
  }

  return (
    <>
      <div className="order-line order-review__item-head">
        <Link to={`/shops/${shopId}`} className="order-line__thumb order-review__shop-thumb">
          <span aria-hidden>{shopName.trim().charAt(0) || '?'}</span>
        </Link>
        <div className="order-line__info">
          <Link to={`/shops/${shopId}`} className="order-line__name">
            {shopName}
          </Link>
          <p className="order-line__meta">
            <span>Seller on this order</span>
          </p>
        </div>
      </div>

      <form className="order-review__form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-group">
          <label>Rating</label>
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
          <label htmlFor="seller-rating-comment">
            Comment <span className="order-review__optional">Optional</span>
          </label>
          <textarea
            id="seller-rating-comment"
            className="form-control"
            rows={3}
            maxLength={REVIEW_MAX_SELLER_COMMENT}
            value={form.comment}
            disabled={mutating}
            placeholder="How was the packaging, delivery time and seller replies?"
            onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, comment: true }))}
          />
          <div className="order-review__field-footer">
            <CharCount value={form.comment} max={REVIEW_MAX_SELLER_COMMENT} />
          </div>
          {visible.comment ? <p className="form-field-error">{visible.comment}</p> : null}
        </div>

        <div className="order-review__actions">
          <button
            type="submit"
            className="account-btn account-btn--primary"
            disabled={!canSubmit || mutating}
          >
            {mutating ? 'Submitting…' : 'Submit seller rating'}
          </button>
          {!canSubmit && !mutating ? (
            <span className="account-muted order-review__hint">Pick a star rating first.</span>
          ) : null}
        </div>
      </form>
    </>
  );
}

type OrderReviewSectionProps = {
  orderId: string;
  shopId: string;
  shopName: string;
  items: BuyerOrderItem[];
  currency?: string;
};

export function OrderReviewSection({
  orderId,
  shopId,
  shopName,
  items,
  currency = 'VND',
}: OrderReviewSectionProps) {
  const [sellerDone, setSellerDone] = useState(false);
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());

  const allDone = sellerDone && reviewedItems.size === items.length;
  const hasProgress = sellerDone || reviewedItems.size > 0;

  return (
    <section className="account-card order-review">
      <h3 className="order-card__title">
        Reviews &amp; ratings
        {hasProgress ? (
          <span className="order-card__count">
            {allDone
              ? 'All done'
              : `${reviewedItems.size}/${items.length} item${items.length === 1 ? '' : 's'}`}
          </span>
        ) : null}
      </h3>
      <p className="account-muted order-review__intro">
        Two steps: rate the seller, then review what you bought. Each submission is sent
        separately.
      </p>

      <div className="order-review__block">
        <StepHead
          step={1}
          title="Rate the seller"
          hint="Packing, delivery speed and how they answered you."
          done={sellerDone}
        />
        <SellerRatingCreateForm
          orderId={orderId}
          shopId={shopId}
          shopName={shopName}
          onSubmitted={() => setSellerDone(true)}
        />
      </div>

      <div className="order-review__block">
        <StepHead
          step={2}
          title={`Review your item${items.length === 1 ? '' : 's'}`}
          hint="One review per product in this order."
          done={reviewedItems.size === items.length && items.length > 0}
        />
        <ul className="order-review__list">
          {items.map((item, index) => (
            <ProductReviewCreateForm
              key={item.orderItemId}
              item={item}
              currency={currency}
              orderId={orderId}
              index={index}
              onSubmitted={() =>
                setReviewedItems((current) => new Set(current).add(item.orderItemId))
              }
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
