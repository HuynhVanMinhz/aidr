import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { useAuth } from '../../hooks/useAuth';
import { useCompare } from '../../hooks/useAi';
import { COMPARE_MIN } from '../../store/aiSlice';
import { formatMoney } from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';

export function ComparePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { selection, loading, error, result, compare, clearResult, remove, clear } = useCompare();

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
  const dimensions = result?.dimensions ?? [];

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

      <div className="page-products">
        <div className="container">
          {loading && <p className="text-muted">Generating comparison…</p>}

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {!loading && result && (
            <>
              <div className="compare-summary mb-4">
                <h2 className="h4">AI summary</h2>
                <p>{result.summary}</p>
                {result.highlights.length > 0 && (
                  <ul className="compare-highlights">
                    {result.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
                <p className="text-muted small mb-0">Source: {result.source}</p>
              </div>

              <div className="table-responsive compare-table-wrap">
                <table className="table table-bordered compare-table">
                  <thead>
                    <tr>
                      <th scope="col">Feature</th>
                      {products.map((p) => (
                        <th key={p.productId} scope="col">
                          <div className="compare-table__product">
                            <img
                              src={p.primaryImageUrl || PLACEHOLDER}
                              alt=""
                              width={72}
                              height={72}
                            />
                            <Link to={`/products/${p.productId}`}>{p.name}</Link>
                            <span>{formatMoney(p.effectivePrice, p.currency)}</span>
                            <button
                              type="button"
                              className="btn-default btn-border"
                              onClick={() => void handleRemove(p.productId)}
                            >
                              Remove
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map((dim) => (
                      <tr key={dim.key}>
                        <th scope="row">{dim.label}</th>
                        {products.map((p) => (
                          <td key={`${dim.key}-${p.productId}`}>
                            {dim.values[p.productId] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 d-flex gap-2 flex-wrap">
                <Link to="/products" className="btn-default btn-border">
                  Back to products
                </Link>
                <button
                  type="button"
                  className="btn-default"
                  onClick={() => {
                    clear();
                    navigate('/products');
                  }}
                >
                  Clear compare list
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
