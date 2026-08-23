import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { ProductCard } from '../../components/catalog/ProductCard';
import { ProductFilters, SORT_OPTIONS } from '../../components/catalog/ProductFilters';
import { useCategories } from '../../hooks/useCatalog';
import {
  defaultCatalogFilters,
  fetchProducts,
  selectCatalogListError,
  selectCatalogListLoading,
  selectCatalogPaging,
  selectCatalogProducts,
  type CatalogFilters,
} from '../../store/catalogSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import type { ProductSort } from '../../types/catalog';

function parseFiltersFromSearch(params: URLSearchParams): CatalogFilters {
  const sortRaw = params.get('sort') || 'newest';
  const allowed: ProductSort[] = ['newest', 'price_asc', 'price_desc', 'popular', 'rating'];
  const sort = allowed.includes(sortRaw as ProductSort) ? (sortRaw as ProductSort) : 'newest';

  const categoryRaw = params.get('categoryId');
  const categoryId = categoryRaw && !Number.isNaN(Number(categoryRaw)) ? Number(categoryRaw) : null;

  const minRatingRaw = params.get('minRating');
  const minRating =
    minRatingRaw && !Number.isNaN(Number(minRatingRaw)) ? Number(minRatingRaw) : null;

  const pageRaw = params.get('page');
  const page = pageRaw && Number(pageRaw) > 0 ? Number(pageRaw) : 1;

  return {
    q: params.get('q') ?? '',
    categoryId,
    brand: params.get('brand') ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    minRating,
    sort,
    page,
    pageSize: defaultCatalogFilters.pageSize,
  };
}

function filtersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.categoryId != null) params.set('categoryId', String(filters.categoryId));
  if (filters.brand.trim()) params.set('brand', filters.brand.trim());
  if (filters.minPrice.trim()) params.set('minPrice', filters.minPrice.trim());
  if (filters.maxPrice.trim()) params.set('maxPrice', filters.maxPrice.trim());
  if (filters.minRating != null) params.set('minRating', String(filters.minRating));
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

export function ProductListPage() {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const products = useAppSelector(selectCatalogProducts);
  const loading = useAppSelector(selectCatalogListLoading);
  const error = useAppSelector(selectCatalogListError);
  const paging = useAppSelector(selectCatalogPaging);
  const { categories } = useCategories();

  const searchKey = searchParams.toString();
  const urlFilters = useMemo(
    () => parseFiltersFromSearch(new URLSearchParams(searchKey)),
    [searchKey],
  );
  const [draft, setDraft] = useState<CatalogFilters>(urlFilters);

  useEffect(() => {
    setDraft(urlFilters);
    void dispatch(fetchProducts(urlFilters));
  }, [dispatch, urlFilters]);

  const syncUrl = useCallback(
    (next: CatalogFilters) => {
      setSearchParams(filtersToSearchParams(next), { replace: false });
    },
    [setSearchParams],
  );

  function handleApply() {
    syncUrl({ ...draft, page: 1 });
  }

  function handleClear() {
    syncUrl({ ...defaultCatalogFilters });
  }

  function goToPage(page: number) {
    syncUrl({ ...urlFilters, page });
  }

  const title = urlFilters.q.trim() ? `Search: ${urlFilters.q.trim()}` : 'Our Products';

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>{title}</h1>
                <CatalogBreadcrumb
                  items={[
                    { label: 'Home', to: '/' },
                    { label: 'Our Products' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-products">
        <div className="container">
          <div className="row">
            <div className="col-xl-3 col-lg-4">
              <ProductFilters
                filters={draft}
                categories={categories}
                onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                onApply={handleApply}
                onClear={handleClear}
              />
            </div>

            <div className="col-xl-9 col-lg-8">
              <div className="product-item-list-box">
                <div className="product-category-filter-header">
                  <div className="product-category-filter-title">
                    <h2>
                      {loading
                        ? 'Loading…'
                        : `Showing ${products.length} of ${paging.totalCount} results`}
                    </h2>
                  </div>
                  <div className="product-category-result-info">
                    <div className="product-category-result-pagination">
                      <ul>
                        {paging.totalPages > 0 &&
                          Array.from({ length: Math.min(paging.totalPages, 5) }, (_, i) => i + 1).map(
                            (p) => (
                              <li key={p}>
                                <a
                                  href={`#page-${p}`}
                                  className={p === paging.page ? 'active' : undefined}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    goToPage(p);
                                  }}
                                >
                                  {p}
                                </a>
                              </li>
                            ),
                          )}
                      </ul>
                    </div>
                    <div className="product-category-sorting-list">
                      <select
                        name="sorting_list"
                        className="form-control form-select"
                        id="sorting_list"
                        value={draft.sort}
                        onChange={(e) => {
                          const sort = e.target.value as ProductSort;
                          setDraft((prev) => ({ ...prev, sort, page: 1 }));
                          syncUrl({ ...draft, sort, page: 1 });
                        }}
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                {!loading && !error && products.length === 0 && (
                  <p className="text-muted">Không tìm thấy sản phẩm phù hợp.</p>
                )}

                <div className="product-item-list">
                  {products.map((product) => (
                    <ProductCard key={product.productId} product={product} variant="list" />
                  ))}
                </div>

                {paging.totalPages > 1 && (
                  <div className="product-learn-more-btn catalog-pager">
                    <button
                      type="button"
                      className="btn-default btn-border"
                      disabled={paging.page <= 1 || loading}
                      onClick={() => goToPage(paging.page - 1)}
                    >
                      Previous
                    </button>
                    <span className="catalog-pager__label">
                      Page {paging.page} / {paging.totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn-default"
                      disabled={paging.page >= paging.totalPages || loading}
                      onClick={() => goToPage(paging.page + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}

                <p className="mt-4 mb-0">
                  <Link to="/categories">Browse categories →</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
