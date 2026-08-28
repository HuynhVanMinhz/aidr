import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ActiveFilterChips } from '../../components/catalog/ActiveFilterChips';
import { CatalogFilterDrawer } from '../../components/catalog/CatalogFilterDrawer';
import { CatalogFiltersPanel } from '../../components/catalog/CatalogFiltersPanel';
import { CatalogSortDropdown } from '../../components/catalog/CatalogSortDropdown';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { NlSearchBar } from '../../components/catalog/NlSearchBar';
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
import {
  buildActiveFilterChips,
  filtersToSearchParams,
  hasActiveFilters,
  parseFiltersFromSearch,
} from '../../utils/catalogFilterUtils';

export function ProductListPage() {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const products = useAppSelector(selectCatalogProducts);
  const loading = useAppSelector(selectCatalogListLoading);
  const error = useAppSelector(selectCatalogListError);
  const paging = useAppSelector(selectCatalogPaging);
  const { categories } = useCategories();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchKey = searchParams.toString();
  const urlFilters = useMemo(
    () => parseFiltersFromSearch(new URLSearchParams(searchKey)),
    [searchKey],
  );

  useEffect(() => {
    void dispatch(fetchProducts(urlFilters));
  }, [dispatch, urlFilters]);

  const syncUrl = useCallback(
    (next: CatalogFilters) => {
      setSearchParams(filtersToSearchParams(next), { replace: false });
    },
    [setSearchParams],
  );

  const handleFilterChange = useCallback(
    (patch: Partial<CatalogFilters>) => {
      syncUrl({ ...urlFilters, ...patch, page: 1 });
    },
    [syncUrl, urlFilters],
  );

  const activeChips = useMemo(
    () => buildActiveFilterChips(urlFilters, categories),
    [urlFilters, categories],
  );

  function handleClear() {
    syncUrl({ ...defaultCatalogFilters });
    setDrawerOpen(false);
  }

  function handleRemoveChip(patch: Partial<CatalogFilters>) {
    syncUrl({ ...urlFilters, ...patch, page: 1 });
  }

  function goToPage(page: number) {
    syncUrl({ ...urlFilters, page });
  }

  const title = urlFilters.q.trim() ? `Search: ${urlFilters.q.trim()}` : 'Our Products';
  const activeFilterCount = activeChips.length;

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
            <div className="col-xl-3 col-lg-4 catalog-filters-sidebar-col">
              <ProductFilters
                filters={urlFilters}
                categories={categories}
                onChange={handleFilterChange}
                onClear={handleClear}
              />
            </div>

            <div className="col-xl-9 col-lg-8">
              <NlSearchBar onApplyFilters={(filters) => syncUrl(filters)} />

              <div className="catalog-mobile-filter-bar">
                <button
                  type="button"
                  className="catalog-mobile-filter-btn"
                  onClick={() => setDrawerOpen(true)}
                >
                  <img src="/theme/images/icon-filter.svg" alt="" />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="catalog-mobile-filter-btn__badge">{activeFilterCount}</span>
                  ) : null}
                </button>
              </div>

              <ActiveFilterChips
                chips={activeChips}
                onRemove={handleRemoveChip}
                onClearAll={handleClear}
              />

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
                      <CatalogSortDropdown
                        value={urlFilters.sort}
                        options={SORT_OPTIONS}
                        onChange={(sort) => syncUrl({ ...urlFilters, sort, page: 1 })}
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                {!loading && !error && products.length === 0 && (
                  <p className="text-muted">
                    {hasActiveFilters(urlFilters)
                      ? 'No products match your filters. Try adjusting or clearing filters.'
                      : 'No matching products found.'}
                  </p>
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

      <CatalogFilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <CatalogFiltersPanel
          filters={urlFilters}
          categories={categories}
          onChange={handleFilterChange}
          onClear={handleClear}
          showHeader={false}
        />
      </CatalogFilterDrawer>
    </>
  );
}
