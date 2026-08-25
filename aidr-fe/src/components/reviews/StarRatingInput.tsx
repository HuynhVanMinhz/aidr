type Props = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
};

export function StarRatingInput({ value, onChange, disabled, label = 'Rating' }: Props) {
  return (
    <div className="review-star-input" role="group" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const active = starValue <= value;
        return (
          <button
            key={starValue}
            type="button"
            className={`review-star-input__btn${active ? ' is-active' : ''}`}
            aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(starValue)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export function StarRatingDisplay({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <div className="customer-review-item-rating catalog-detail-rating" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'catalog-star is-on' : 'catalog-star'} aria-hidden>
          ★
        </span>
      ))}
    </div>
  );
}
