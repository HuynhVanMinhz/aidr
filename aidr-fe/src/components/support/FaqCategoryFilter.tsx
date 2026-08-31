import type { FaqCategory } from '../../data/supportContent';
import { FAQ_CATEGORIES } from '../../data/supportContent';

interface FaqCategoryFilterProps {
  value: FaqCategory | 'all';
  onChange: (value: FaqCategory | 'all') => void;
}

export function FaqCategoryFilter({ value, onChange }: FaqCategoryFilterProps) {
  return (
    <div className="support-filter" role="group" aria-label="Filter by category">
      {FAQ_CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`support-filter__chip${value === cat.id ? ' is-active' : ''}`}
          aria-pressed={value === cat.id}
          onClick={() => onChange(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
