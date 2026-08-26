import { Link } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { useSimilarProducts } from '../../hooks/useRecommendations';
import { toProductListItem } from '../../types/ai';

type Props = {
  productId: string;
  categoryId?: number;
  limit?: number;
};

export function SimilarProductsSection({ productId, categoryId, limit = 8 }: Props) {
  const { items, loading, error } = useSimilarProducts(productId, { limit });

  if (!loading && !error && items.length === 0) {
    return null;
  }

  const shopAllTo =
    categoryId != null ? `/products?categoryId=${categoryId}` : '/products?sort=popular';

  return (
    <div className="related-products">
      <div className="container">
        <div className="row section-row align-items-center">
          <div className="col-xl-7">
            <div className="section-title">
              <span className="section-sub-title">Similar Products</span>
              <h2 className="text-anime-style-3">You May Also Like</h2>
            </div>
          </div>
          <div className="col-xl-5">
            <div className="section-btn">
              <Link to={shopAllTo} className="btn-default">
                Shop All
              </Link>
            </div>
          </div>
        </div>

        {loading && <p>Loading similar products…</p>}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="row">
            <div className="col-lg-12">
              <div className="related-product-items-list">
                {items.map((product) => (
                  <ProductCard
                    key={product.productId}
                    product={toProductListItem(product)}
                    variant="list"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
