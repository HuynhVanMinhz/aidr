import { useEffect, useMemo, useState } from 'react';
import * as productApi from '../../services/productApi';
import type { BrandFilterOption, CategoryTreeNode, ProductSort } from '../../types/catalog';
import type { CatalogFilters } from '../../store/catalogSlice';
import { resolveDynamicSpecFilters } from '../../utils/catalogSpecFilterConfig';
import { CategoryFilterTree } from './CategoryFilterTree';
import { FilterBrandList } from './filters/FilterBrandList';
import { FilterCheckbox } from './filters/FilterCheckbox';
import { FilterPriceRange } from './filters/FilterPriceRange';
import { FilterSection } from './filters/FilterSection';
import { FilterStarRating } from './filters/FilterStarRating';
import { DynamicSpecFilters } from './filters/DynamicSpecFilters';

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Default Sorting' },
  { value: 'price_asc', label: 'Low to High' },
  { value: 'price_desc', label: 'High to Low' },
  { value: 'popular', label: 'Popularity' },
  { value: 'rating', label: 'Most Reviewed' },
];

const CONDITION_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'LikeNew', label: 'Like new' },
  { value: 'Refurbished', label: 'Refurbished' },
  { value: 'Used', label: 'Used' },
];

const SEARCH_DEBOUNCE_MS = 400;

type Props = {
  filters: CatalogFilters;
  categories: CategoryTreeNode[];
  onChange: (patch: Partial<CatalogFilters>) => void;
  onClear: () => void;
  showHeader?: boolean;
};

export function CatalogFiltersPanel({
  filters,
  categories,
  onChange,
  onClear,
  showHeader = true,
}: Props) {
  const [brands, setBrands] = useState<BrandFilterOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.q);

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (searchDraft === filters.q) return;
    const timer = window.setTimeout(() => {
      onChange({ q: searchDraft });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.q, onChange]);

  useEffect(() => {
    let cancelled = false;
    setBrandsLoading(true);
    void productApi
      .getProductBrands()
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) setBrands(result.data);
      })
      .finally(() => {
        if (!cancelled) setBrandsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dynamicSpecs = useMemo(
    () => resolveDynamicSpecFilters(filters.categoryIds, categories),
    [filters.categoryIds, categories],
  );

  function toggleCondition(value: string) {
    const next = filters.conditions.includes(value)
      ? filters.conditions.filter((c) => c !== value)
      : [...filters.conditions, value];
    onChange({ conditions: next });
  }

  return (
    <div className="catalog-filters-panel">
      {showHeader ? (
        <div className="catalog-filters-panel__header">
          <div className="catalog-filters-panel__title">
            <img src="/theme/images/icon-filter.svg" alt="" />
            <h2>Filter By</h2>
          </div>
          <button type="button" className="catalog-filters-panel__clear" onClick={onClear}>
            Clear All
          </button>
        </div>
      ) : null}

      <div className="catalog-filters-panel__form">
        <FilterSection title="Search" defaultOpen>
          <input
            type="search"
            className="catalog-filter-field"
            placeholder="Search by products…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </FilterSection>

        <FilterSection title="Categories" badge={filters.categoryIds.length} defaultOpen>
          <CategoryFilterTree
            categories={categories}
            selectedIds={filters.categoryIds}
            onChange={(categoryIds) => onChange({ categoryIds })}
          />
        </FilterSection>

        <DynamicSpecFilters
          defs={dynamicSpecs}
          values={filters.specFilters}
          onChange={(specFilters) => onChange({ specFilters })}
        />

        <FilterSection title="Brands" badge={filters.brands.length} defaultOpen>
          <FilterBrandList
            brands={brands}
            selected={filters.brands}
            loading={brandsLoading}
            onChange={(brands) => onChange({ brands })}
          />
        </FilterSection>

        <FilterSection title="Price (VND)" defaultOpen>
          <FilterPriceRange
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            onChange={(patch) => onChange(patch)}
          />
        </FilterSection>

        <FilterSection title="Customer Ratings" defaultOpen>
          <FilterStarRating
            value={filters.minRating}
            onChange={(minRating) => onChange({ minRating })}
          />
        </FilterSection>

        <FilterSection title="Offers & availability" defaultOpen>
          <ul className="catalog-filter-option-list">
            <li>
              <FilterCheckbox
                id="filter_on_sale"
                checked={filters.onSale === true}
                label="On sale / Discount"
                onChange={() => onChange({ onSale: filters.onSale ? null : true })}
              />
            </li>
            <li>
              <FilterCheckbox
                id="filter_in_stock"
                checked={filters.inStock === true}
                label="In stock only"
                onChange={() => onChange({ inStock: filters.inStock ? null : true })}
              />
            </li>
          </ul>
        </FilterSection>

        <FilterSection title="Condition" badge={filters.conditions.length}>
          <ul className="catalog-filter-option-list">
            {CONDITION_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <FilterCheckbox
                  id={`cond_${opt.value}`}
                  checked={filters.conditions.includes(opt.value)}
                  label={opt.label}
                  onChange={() => toggleCondition(opt.value)}
                />
              </li>
            ))}
          </ul>
        </FilterSection>
      </div>
    </div>
  );
}
