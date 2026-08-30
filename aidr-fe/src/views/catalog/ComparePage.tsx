import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { useAuth } from '../../hooks/useAuth';
import { useCompare } from '../../hooks/useAi';
import { useToastMessage } from '../../hooks/useToastMessage';
import { COMPARE_MIN } from '../../store/aiSlice';
import {
  buildCompareInsights,
  buildCompareRecommendation,
  buildDimensionWinners,
  enrichCompareDimensions,
  formatCompareCell,
  formatPricesInText,
  productBadge,
} from '../../utils/compareUi';
import { formatMoney } from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';

const EMPTY_CELL_RE =
  /^(Not available|Not specified|No reviews yet|No sales yet|No discount|Out of stock)$/i;

export function ComparePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { selection, loading, error, result, compare, clearResult, remove, clear } = useCompare();
  useToastMessage(error);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?returnUrl=${encodeURIComponent('/compare')}`, { replace: true });
      return;
    }
    if (selection.length < COMPARE_MIN) {
      navigate('/products', { replace: true });
      return;
    }

    void compare();
    return () => {
      clearResult();
    };
    // Intentionally run once on mount with the selection present at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const products = result?.products ?? [];
  const dimensions = useMemo(
    () => (result ? enrichCompareDimensions(products, result.dimensions ?? []) : []),
    [result, products],
  );

  const winners = useMemo(
    () => (result ? buildDimensionWinners(products, dimensions) : {}),
    [result, products, dimensions],
  );

  const insights = useMemo(
    () => (result ? buildCompareInsights(products, dimensions, winners) : []),
    [result, products, dimensions, winners],
  );

  const recommendation = useMemo(
    () =>
      result ? buildCompareRecommendation({ ...result, dimensions }, winners) : null,
    [result, dimensions, winners],
  );

  const summaryText = result ? formatPricesInText(result.summary) : '';

  async function handleRemove(productId: string) {
    const nextIds = selection.filter((s) => s.productId !== productId).map((s) => s.productId);
    remove(productId);
    if (nextIds.length < COMPARE_MIN) {
      navigate('/products');
      return;
    }
    try {
      await compare(nextIds);
    } catch {
      // error stored in slice
    }
  }

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Compare Products</h1>
                <CatalogBreadcrumb
                  items={[
                    { label: 'Home', to: '/' },
                    { label: 'Products', to: '/products' },
                    { label: 'Compare' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-products compare-page">
        <div className="container">
          {loading && <p className="text-muted">Generating comparison…</p>}


          {!loading && result && (
            <>
              <section className="compare-summary" aria-labelledby="compare-summary-heading">
                <div className="compare-summary__head">
                  <h2 id="compare-summary-heading" className="compare-summary__title">
                    AI Summary
                  </h2>
                  <span className="compare-summary__source">Source: {result.source}</span>
                </div>
                <p className="compare-summary__text">{summaryText}</p>
                {insights.length > 0 && (
                  <ul className="compare-insight-grid" aria-label="Key insights">
                    {insights.map((insight) => (
                      <li key={`${insight.kind}-${insight.productId}`} className="compare-insight-chip">
                        <span className="compare-insight-chip__label">{insight.label}</span>
                        <span className="compare-insight-chip__value">{insight.value}</span>
                        <span className="compare-insight-chip__product">{insight.productName}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {insights.length === 0 && result.highlights.length > 0 && (
                  <ul className="compare-highlights">
                    {result.highlights.map((h) => (
                      <li key={h}>{formatPricesInText(h)}</li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="compare-table-wrap compare-table-wrap--desktop">
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th scope="col" className="compare-table__feature-col">
                        Feature
                      </th>
                      {products.map((p) => {
                        const badge = productBadge(p.productId, insights, recommendation);
                        const isRecommended = recommendation?.productId === p.productId;
                        return (
                          <th
                            key={p.productId}
                            scope="col"
                            className={isRecommended ? 'is-recommended-col' : undefined}
                          >
                            <div className="compare-table__product">
                              <div className="compare-table__product-badge-slot">
                                {badge ? (
                                  <span
                                    className={`compare-product-badge${isRecommended ? ' is-recommended' : ''}`}
                                  >
                                    {badge}
                                  </span>
                                ) : null}
                              </div>
                              <div className="compare-table__product-media">
                                <img
                                  src={p.primaryImageUrl || PLACEHOLDER}
                                  alt=""
                                  width={120}
                                  height={120}
                                />
                              </div>
                              <Link
                                to={`/products/${p.productId}`}
                                className="compare-table__product-name"
                              >
                                {p.name}
                              </Link>
                              <span className="compare-table__product-price">
                                {formatMoney(p.effectivePrice, p.currency)}
                              </span>
                              <span className="compare-table__product-rating">
                                {p.avgRating > 0 && p.reviewCount > 0
                                  ? `${p.avgRating.toFixed(1)} ★ · ${p.reviewCount} reviews`
                                  : 'No reviews yet'}
                              </span>
                              <div className="compare-table__product-actions">
                                <Link
                                  to={`/products/${p.productId}`}
                                  className="btn-default compare-table__view-btn"
                                >
                                  View Product
                                </Link>
                                <button
                                  type="button"
                                  className="compare-table__remove"
                                  aria-label={`Remove ${p.name} from compare`}
                                  onClick={() => void handleRemove(p.productId)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map((dim) => {
                      const dimWinners = winners[dim.key] ?? new Set<string>();
                      return (
                        <tr key={dim.key}>
                          <th scope="row" className="compare-table__feature-col">
                            {dim.label}
                          </th>
                          {products.map((p) => {
                            const isWinner = dimWinners.has(p.productId);
                            const display = formatCompareCell(dim, p);
                            return (
                              <td
                                key={`${dim.key}-${p.productId}`}
                                className={isWinner ? 'is-winner' : undefined}
                              >
                                <span className="compare-cell">
                                  <span className={EMPTY_CELL_RE.test(display) ? 'compare-cell__empty' : undefined}>
                                    {display}
                                  </span>
                                  {isWinner && (
                                    <span className="compare-winner-mark" aria-label="Best in this row">
                                      Best
                                    </span>
                                  )}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="compare-cards compare-cards--mobile" aria-label="Product comparison cards">
                {products.map((p) => {
                  const badge = productBadge(p.productId, insights, recommendation);
                  const isRecommended = recommendation?.productId === p.productId;
                  return (
                    <article
                      key={p.productId}
                      className={`compare-card${isRecommended ? ' is-recommended' : ''}`}
                    >
                      <div className="compare-card__header">
                        {badge && (
                          <span
                            className={`compare-product-badge${isRecommended ? ' is-recommended' : ''}`}
                          >
                            {badge}
                          </span>
                        )}
                        <button
                          type="button"
                          className="compare-table__remove"
                          aria-label={`Remove ${p.name} from compare`}
                          onClick={() => void handleRemove(p.productId)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="compare-card__media">
                        <img src={p.primaryImageUrl || PLACEHOLDER} alt="" width={140} height={140} />
                      </div>
                      <Link to={`/products/${p.productId}`} className="compare-table__product-name">
                        {p.name}
                      </Link>
                      <span className="compare-table__product-price">
                        {formatMoney(p.effectivePrice, p.currency)}
                      </span>
                      <ul className="compare-card__specs">
                        {dimensions.map((dim) => {
                          const isWinner = (winners[dim.key] ?? new Set()).has(p.productId);
                          const display = formatCompareCell(dim, p);
                          return (
                            <li
                              key={`${p.productId}-${dim.key}`}
                              className={isWinner ? 'is-winner' : undefined}
                            >
                              <span className="compare-card__spec-label">{dim.label}</span>
                              <span className="compare-card__spec-value">
                                <span className={EMPTY_CELL_RE.test(display) ? 'compare-cell__empty' : undefined}>
                                  {display}
                                </span>
                                {isWinner && (
                                  <span className="compare-winner-mark" aria-label="Best in this criterion">
                                    Best
                                  </span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <Link to={`/products/${p.productId}`} className="btn-default compare-table__view-btn">
                        View Product
                      </Link>
                    </article>
                  );
                })}
              </div>

              {recommendation && (
                <section
                  className="compare-recommendation"
                  aria-labelledby="compare-recommendation-heading"
                >
                  <div className="compare-recommendation__body">
                    <p className="compare-recommendation__eyebrow">AI Recommendation</p>
                    <h2 id="compare-recommendation-heading" className="compare-recommendation__title">
                      {recommendation.headline}
                    </h2>
                    <p className="compare-recommendation__reason">{recommendation.reason}</p>
                    <Link
                      to={`/products/${recommendation.productId}`}
                      className="btn-default compare-table__view-btn"
                    >
                      View Recommended Product
                    </Link>
                  </div>
                </section>
              )}

              <div className="compare-page-actions">
                <Link to="/products" className="btn-default btn-border">
                  Back to Products
                </Link>
                <button
                  type="button"
                  className="btn-default btn-border compare-page-actions__clear"
                  onClick={() => {
                    clear();
                    navigate('/products');
                  }}
                >
                  Clear Compare List
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
