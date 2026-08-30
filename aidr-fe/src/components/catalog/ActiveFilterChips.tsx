import type { CatalogFilters } from '../../store/catalogSlice';
import type { ActiveFilterChip } from '../../utils/catalogFilterUtils';

type Props = {
  chips: ActiveFilterChip[];
  onRemove: (patch: Partial<CatalogFilters>) => void;
  onClearAll: () => void;
};

export function ActiveFilterChips({ chips, onRemove, onClearAll }: Props) {
  if (chips.length === 0) return null;

  return (
    <div className="catalog-active-filters" aria-label="Active filters">
      <span className="catalog-active-filters__label">Active filters:</span>
      <ul className="catalog-active-filters__list">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              className="catalog-active-filters__chip"
              onClick={() => onRemove(chip.clear)}
              aria-label={`Remove filter ${chip.label}`}
            >
              <span>{chip.label}</span>
              <i className="fa-solid fa-xmark" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="catalog-active-filters__clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
