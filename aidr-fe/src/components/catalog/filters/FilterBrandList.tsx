import { useMemo, useState } from 'react';
import type { BrandFilterOption } from '../../../types/catalog';
import { toggleBrand } from '../../../utils/catalogFilterUtils';
import { FilterCheckbox } from './FilterCheckbox';

const VISIBLE_LIMIT = 8;

type Props = {
  brands: BrandFilterOption[];
  selected: string[];
  loading?: boolean;
  onChange: (brands: string[]) => void;
};

export function FilterBrandList({ brands, selected, loading, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.brand.toLowerCase().includes(q));
  }, [brands, query]);

  const visible = showAll ? filtered : filtered.slice(0, VISIBLE_LIMIT);
  const hiddenCount = Math.max(0, filtered.length - VISIBLE_LIMIT);

  if (loading) return <p className="catalog-filter-empty">Loading brands…</p>;
  if (brands.length === 0) return <p className="catalog-filter-empty">No brands available.</p>;

  return (
    <div className="catalog-filter-brand">
      <input
        type="search"
        className="catalog-filter-field catalog-filter-brand__search"
        placeholder="Search brands…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="catalog-filter-brand__list catalog-filter-scroll">
        {visible.map((item) => (
          <li key={item.brand}>
            <FilterCheckbox
              id={`brand_${item.brand}`}
              checked={selected.includes(item.brand)}
              label={item.brand}
              count={item.productCount}
              onChange={() => onChange(toggleBrand(selected, item.brand))}
            />
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? (
        <p className="catalog-filter-empty">No brands match your search.</p>
      ) : null}
      {hiddenCount > 0 && !showAll ? (
        <button type="button" className="catalog-filter-more" onClick={() => setShowAll(true)}>
          Show more ({hiddenCount})
        </button>
      ) : null}
      {showAll && filtered.length > VISIBLE_LIMIT ? (
        <button type="button" className="catalog-filter-more" onClick={() => setShowAll(false)}>
          Show less
        </button>
      ) : null}
    </div>
  );
}
