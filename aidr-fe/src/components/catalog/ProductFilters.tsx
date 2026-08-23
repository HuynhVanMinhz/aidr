import type { CategoryTreeNode, ProductSort } from '../../types/catalog';
import type { CatalogFilters } from '../../store/catalogSlice';

type Props = {
  filters: CatalogFilters;
  categories: CategoryTreeNode[];
  onChange: (patch: Partial<CatalogFilters>) => void;
  onApply: () => void;
  onClear: () => void;
};

const RATING_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Tất cả' },
  { value: 4, label: '4 sao trở lên' },
  { value: 3, label: '3 sao trở lên' },
];

function flattenCategories(nodes: CategoryTreeNode[], depth = 0): { id: number; label: string }[] {
  const rows: { id: number; label: string }[] = [];
  for (const node of nodes) {
    const prefix = depth > 0 ? `${'—'.repeat(depth)} ` : '';
    rows.push({ id: node.categoryId, label: `${prefix}${node.name}` });
    if (node.children?.length) {
      rows.push(...flattenCategories(node.children, depth + 1));
    }
  }
  return rows;
}

/** Sidebar filters — markup theo theme products.html `.page-single-sidebar`. */
export function ProductFilters({ filters, categories, onChange, onApply, onClear }: Props) {
  const flatCategories = flattenCategories(categories);

  return (
    <div className="page-single-sidebar">
      <div className="product-category-filter-header">
        <div className="product-category-filter-title">
          <img src="/theme/images/icon-filter.svg" alt="" />
          <h2>Filter By</h2>
        </div>
        <div className="product-category-filter-clear-btn">
          <a
            href="#clear"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
          >
            Clear All
          </a>
        </div>
      </div>

      <form
        className="product-category-item-list"
        onSubmit={(e) => {
          e.preventDefault();
          onApply();
        }}
      >
        <div className="product-category-item">
          <h2 className="product-category-item-title">Search</h2>
          <div className="form-group mb-0">
            <input
              type="search"
              className="form-control"
              placeholder="Search By Products..."
              value={filters.q}
              onChange={(e) => onChange({ q: e.target.value })}
            />
          </div>
        </div>

        <div className="product-category-item">
          <h2 className="product-category-item-title">Categories</h2>
          <ul>
            <li>
              <input
                type="radio"
                id="cat_all"
                name="categoryId"
                checked={filters.categoryId == null}
                onChange={() => onChange({ categoryId: null })}
              />
              <label htmlFor="cat_all">Tất cả</label>
            </li>
            {flatCategories.map((c) => (
              <li key={c.id}>
                <input
                  type="radio"
                  id={`cat_${c.id}`}
                  name="categoryId"
                  checked={filters.categoryId === c.id}
                  onChange={() => onChange({ categoryId: c.id })}
                />
                <label htmlFor={`cat_${c.id}`}>{c.label}</label>
              </li>
            ))}
          </ul>
        </div>

        <div className="product-category-item">
          <h2 className="product-category-item-title">Brands</h2>
          <div className="form-group mb-0">
            <input
              type="text"
              className="form-control"
              placeholder="Brand name"
              value={filters.brand}
              maxLength={100}
              onChange={(e) => onChange({ brand: e.target.value })}
            />
          </div>
        </div>

        <div className="product-category-item">
          <h2 className="product-category-item-title">Price (VND)</h2>
          <div className="row g-2">
            <div className="col-6">
              <input
                type="number"
                className="form-control"
                placeholder="Min"
                min={0}
                value={filters.minPrice}
                onChange={(e) => onChange({ minPrice: e.target.value })}
              />
            </div>
            <div className="col-6">
              <input
                type="number"
                className="form-control"
                placeholder="Max"
                min={0}
                value={filters.maxPrice}
                onChange={(e) => onChange({ maxPrice: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="product-category-item">
          <h2 className="product-category-item-title">Customer Ratings</h2>
          <ul>
            {RATING_OPTIONS.map((opt) => (
              <li key={String(opt.value)}>
                <input
                  type="radio"
                  id={`rating_${opt.value ?? 'all'}`}
                  name="minRating"
                  checked={filters.minRating === opt.value}
                  onChange={() => onChange({ minRating: opt.value })}
                />
                <label htmlFor={`rating_${opt.value ?? 'all'}`}>{opt.label}</label>
              </li>
            ))}
          </ul>
        </div>

        <button type="submit" className="btn-default btn-accent w-100">
          Apply Filters
        </button>
      </form>
    </div>
  );
}

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Default Sorting' },
  { value: 'price_asc', label: 'Low to High' },
  { value: 'price_desc', label: 'High to Low' },
  { value: 'popular', label: 'Popularity' },
  { value: 'rating', label: 'Most Reviewed' },
];
