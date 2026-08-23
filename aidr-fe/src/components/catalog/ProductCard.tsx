import { Link } from 'react-router-dom';
import type { ProductListItem } from '../../types/catalog';
import { discountPercent, formatMoney } from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';

type Props = {
  product: ProductListItem;
  /** home = index our-products layout; list = products.html layout */
  variant?: 'home' | 'list';
};

export function ProductCard({ product, variant = 'list' }: Props) {
  const off = discountPercent(product.basePrice, product.salePrice);
  const imageUrl = product.primaryImageUrl || PLACEHOLDER;
  const detailTo = `/products/${product.productId}`;

  const priceBlock = (
    <h3>
      {formatMoney(product.effectivePrice, product.currency)}
      {product.salePrice != null && product.salePrice < product.basePrice && (
        <span>{formatMoney(product.basePrice, product.currency)}</span>
      )}
    </h3>
  );

  const header = (
    <div className="product-item-header">
      {off != null && (
        <div className="product-item-discount-tag">
          <span>{off}% Off</span>
        </div>
      )}
      <div className="product-item-image">
        <Link to={detailTo}>
          <figure>
            <img src={imageUrl} alt={product.name} loading="lazy" />
          </figure>
        </Link>
      </div>
      <div className="product-item-action">
        <ul>
          <li>
            <Link to="/login" title="Yêu thích" aria-label="Yêu thích">
              <img src="/theme/images/icon-wishlist-primary.svg" alt="" />
            </Link>
          </li>
          <li>
            <Link to={detailTo} title="Xem nhanh" aria-label="Xem nhanh">
              <img src="/theme/images/icon-preview-primary.svg" alt="" />
            </Link>
          </li>
          <li>
            <Link to="/login" title="Giỏ hàng" aria-label="Giỏ hàng">
              <img src="/theme/images/icon-cart-primary.svg" alt="" />
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );

  if (variant === 'home') {
    return (
      <div className="product-item">
        {header}
        <div className="product-item-body">
          <div className="product-item-content">
            <h2>
              <Link to={detailTo}>{product.name}</Link>
            </h2>
            {priceBlock}
          </div>
          <div className="product-item-btn">
            <Link to={detailTo} className="btn-default">
              Xem chi tiết
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="product-item">
      {header}
      <div className="product-item-content">
        <span className="product-item-tag">
          <Link to={`/products?categoryId=${product.categoryId}`}>{product.categoryName}</Link>
        </span>
        <h2 className="product-item-title">
          <Link to={detailTo}>{product.name}</Link>
        </h2>
        {priceBlock}
      </div>
    </div>
  );
}
