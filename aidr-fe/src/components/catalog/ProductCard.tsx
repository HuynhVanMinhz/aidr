import { useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import type { ProductListItem } from '../../types/catalog';
import { discountPercent, formatMoney } from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';

type Props = {
  product: ProductListItem;
  /** home = index our-products layout; list = products.html layout */
  variant?: 'home' | 'list';
};

export function ProductCard({ product, variant = 'list' }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addItem, getErrorMessage } = useCart();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const off = discountPercent(product.basePrice, product.salePrice);
  const imageUrl = product.primaryImageUrl || PLACEHOLDER;
  const detailTo = `/products/${product.productId}`;
  const outOfStock = product.availableQuantity < 1;

  async function handleQuickAdd(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate(`/login?returnUrl=${encodeURIComponent(detailTo)}`);
      return;
    }
    if (outOfStock) {
      toast.error('Product is out of stock.');
      return;
    }

    setAdding(true);
    try {
      await addItem(product.productId, 1);
      toast.success('Added to cart.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to add item to cart.'));
    } finally {
      setAdding(false);
    }
  }

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
            <Link to="/login" title="Wishlist" aria-label="Wishlist">
              <img src="/theme/images/icon-wishlist-primary.svg" alt="" />
            </Link>
          </li>
          <li>
            <Link to={detailTo} title="Quick view" aria-label="Quick view">
              <img src="/theme/images/icon-preview-primary.svg" alt="" />
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="product-card-cart-btn"
              title="Add to cart"
              aria-label="Add to cart"
              disabled={adding || outOfStock}
              onClick={(e) => void handleQuickAdd(e)}
            >
              <img src="/theme/images/icon-cart-primary.svg" alt="" />
            </button>
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
              View details
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
