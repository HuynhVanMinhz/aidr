type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
};

const STAR_OPTIONS = [5, 4, 3, 2, 1] as const;

function StarRow({ count }: { count: number }) {
  return (
    <span className="catalog-filter-stars is-filled" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <i
          key={i}
          className={i < count ? 'fa-solid fa-star' : 'fa-regular fa-star'}
        />
      ))}
    </span>
  );
}

export function FilterStarRating({ value, onChange }: Props) {
  return (
    <ul className="catalog-filter-rating-list">
      <li>
        <button
          type="button"
          className={`catalog-filter-rating-option${value === null ? ' is-selected' : ''}`}
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          <span className="catalog-filter-rating-option__all">All ratings</span>
        </button>
      </li>
      {STAR_OPTIONS.map((stars) => {
        const selected = value === stars;
        return (
          <li key={stars}>
            <button
              type="button"
              className={`catalog-filter-rating-option${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onChange(stars)}
            >
              <StarRow count={stars} />
              <span>{stars} {stars === 1 ? 'star' : 'stars'} & up</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
