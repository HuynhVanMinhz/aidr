import { Link } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { useRecommendations } from '../../hooks/useRecommendations';
import { useToastMessage } from '../../hooks/useToastMessage';
import { toProductListItem } from '../../types/ai';

type Props = {
  pageSize?: number;
};

export function RecommendedProductsSection({ pageSize = 6 }: Props) {
  const { items, loading, error } = useRecommendations({ pageSize });
  useToastMessage(error);

  // Errors are surfaced as a toast; a supplementary section just stays hidden.
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <div className="our-products">
      <div className="container">
        <div className="row section-row align-items-center">
          <div className="col-xl-7">
            <div className="section-title">
              <span className="section-sub-title">For You</span>
              <h2 className="text-anime-style-3">Recommended Products</h2>
            </div>
          </div>
          <div className="col-xl-5">
            <div className="section-btn">
              <Link to="/products?sort=popular" className="btn-default">
                Shop Now
              </Link>
            </div>
          </div>
        </div>

        {loading && <p>Loading recommendations…</p>}

        {!loading && items.length > 0 && (
          <div className="row">
            <div className="col-lg-12">
              <div className="product-item-list">
                {items.map((product) => (
                  <ProductCard
                    key={product.productId}
                    product={toProductListItem(product)}
                    variant="home"
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
