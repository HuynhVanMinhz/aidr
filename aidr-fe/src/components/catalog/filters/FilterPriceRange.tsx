import type { CSSProperties } from 'react';
import type { CatalogFilters } from '../../../store/catalogSlice';

const PRICE_MAX = 50_000_000;
const STEP = 100_000;

const PRESETS: { label: string; min: string; max: string }[] = [
  { label: 'Under 5M', min: '', max: '5000000' },
  { label: '5M – 10M', min: '5000000', max: '10000000' },
  { label: '10M – 20M', min: '10000000', max: '20000000' },
  { label: '20M – 50M', min: '20000000', max: '50000000' },
  { label: 'Over 50M', min: '50000000', max: '' },
];

type Props = {
  minPrice: string;
  maxPrice: string;
  onChange: (patch: Pick<CatalogFilters, 'minPrice' | 'maxPrice'>) => void;
};

function toNum(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function FilterPriceRange({ minPrice, maxPrice, onChange }: Props) {
  const minVal = toNum(minPrice);
  const maxVal = maxPrice.trim() ? toNum(maxPrice) : PRICE_MAX;
  const minPct = (minVal / PRICE_MAX) * 100;
  const maxPct = (maxVal / PRICE_MAX) * 100;

  function handleMin(next: number) {
    const capped = Math.min(next, maxVal);
    onChange({ minPrice: capped <= 0 ? '' : String(capped), maxPrice });
  }

  function handleMax(next: number) {
    const capped = Math.max(next, minVal);
    onChange({
      minPrice,
      maxPrice: capped >= PRICE_MAX ? '' : String(capped),
    });
  }

  const trackStyle = {
    '--range-min': `${minPct}%`,
    '--range-max': `${maxPct}%`,
  } as CSSProperties;

  return (
    <div className="catalog-filter-price">
      <div className="catalog-filter-price__inputs">
        <input
          type="number"
          className="catalog-filter-field"
          placeholder="Min"
          min={0}
          value={minPrice}
          onChange={(e) => onChange({ minPrice: e.target.value, maxPrice })}
        />
        <span className="catalog-filter-price__sep">–</span>
        <input
          type="number"
          className="catalog-filter-field"
          placeholder="Max"
          min={0}
          value={maxPrice}
          onChange={(e) => onChange({ minPrice, maxPrice: e.target.value })}
        />
      </div>

      <div className="catalog-dual-range" style={trackStyle}>
        <div className="catalog-dual-range__track" aria-hidden />
        <input
          type="range"
          className="catalog-dual-range__input catalog-dual-range__input--min"
          min={0}
          max={PRICE_MAX}
          step={STEP}
          value={minVal}
          onChange={(e) => handleMin(Number(e.target.value))}
          aria-label="Minimum price"
        />
        <input
          type="range"
          className="catalog-dual-range__input catalog-dual-range__input--max"
          min={0}
          max={PRICE_MAX}
          step={STEP}
          value={maxVal}
          onChange={(e) => handleMax(Number(e.target.value))}
          aria-label="Maximum price"
        />
      </div>

      <div className="catalog-filter-price__presets">
        {PRESETS.map((preset) => {
          const active = minPrice === preset.min && maxPrice === preset.max;
          return (
            <button
              key={preset.label}
              type="button"
              className={`catalog-filter-pill${active ? ' is-active' : ''}`}
              onClick={() => onChange({ minPrice: preset.min, maxPrice: preset.max })}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
