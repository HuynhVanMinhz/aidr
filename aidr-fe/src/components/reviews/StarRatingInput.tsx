import { useState } from 'react';

type Props = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  /** Hides the "4/5 — Very good" caption when the caller has its own. */
  showCaption?: boolean;
};

/** What each score means, so the number is not the only feedback. */
const SCORE_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export function StarRatingInput({
  value,
  onChange,
  disabled,
  label = 'Rating',
  showCaption = true,
}: Props) {
  // Hovering previews the score it would set; without it the stars give no
  // feedback until after the click, which reads as an unresponsive control.
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="review-star-field">
      <div
        className="review-star-input"
        role="group"
        aria-label={label}
        onMouseLeave={() => setHover(0)}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const starValue = index + 1;
          const picked = starValue <= value;
          const previewed = starValue <= shown;
          return (
            <button
              key={starValue}
              type="button"
              className={[
                'review-star-input__btn',
                previewed ? 'is-active' : '',
                // Chosen and merely hovered look different: the pick has to
                // survive the mouse moving away.
                picked ? 'is-picked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
              aria-pressed={picked}
              disabled={disabled}
              onMouseEnter={() => setHover(starValue)}
              onFocus={() => setHover(starValue)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(starValue)}
            >
              ★
            </button>
          );
        })}
      </div>

      <span className={`review-star-caption${shown ? ' is-set' : ''}`}>
        {showCaption
          ? shown
            ? `${shown}/5 — ${SCORE_WORDS[shown]}`
            : 'Tap a star to rate'
          : null}
      </span>
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
