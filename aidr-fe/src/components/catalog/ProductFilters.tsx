import type { CategoryTreeNode } from '../../types/catalog';
import type { CatalogFilters } from '../../store/catalogSlice';
import { CatalogFiltersPanel } from './CatalogFiltersPanel';

type Props = {
  filters: CatalogFilters;
  categories: CategoryTreeNode[];
  onChange: (patch: Partial<CatalogFilters>) => void;
  onClear: () => void;
};

/** Desktop sidebar wrapper for catalog filters. */
export function ProductFilters(props: Props) {
  return (
    <div className="page-single-sidebar catalog-filters-sidebar">
      <CatalogFiltersPanel {...props} />
    </div>
  );
}

export { SORT_OPTIONS } from './CatalogFiltersPanel';
