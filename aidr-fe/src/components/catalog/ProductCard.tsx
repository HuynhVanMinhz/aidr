import { useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCompare } from '../../hooks/useAi';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { useWishlistProduct } from '../../hooks/useWishlist';
import type { ProductListItem } from '../../types/catalog';
import { resolveProductImageUrl } from '../../utils/catalogImage';
import { discountPercent, formatMoney } from '../../utils/formatCatalog';

type Props = {
  product: ProductListItem;
  /** home = index our-products layout; list = products.html layout */
  variant?: 'home' | 'list';
};

export function ProductCard({ product, variant = 'list' }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addItem, getErrorMessage } = useCart();
  const { toggle: toggleCompare, isSelected } = useCompare();
  const inCompare = isSelected(product.productId);
  const {
    inWishlist,
    toggle,
    mutating: wishlistBusy,
    getErrorMessage: getWishlistError,
  } = useWishlistProduct(product.productId);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [wishlistPending, setWishlistPending] = useState(false);

  const off = discountPercent(product.basePrice, product.salePrice);
  const imageUrl = resolveProductImageUrl(product.primaryImageUrl, product.name?.length ?? 0);
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

  async function handleWishlist(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate(`/login?returnUrl=${encodeURIComponent(detailTo)}`);
      return;
    }

    setWishlistPending(true);
    try {
      await toggle();
      toast.success(inWishlist ? 'Removed from wishlist.' : 'Added to wishlist.');
    } catch (err) {
      toast.error(getWishlistError(err, 'Unable to update wishlist.'));
    } finally {
      setWishlistPending(false);
    }
  }

  function handleCompare(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompare({
      productId: product.productId,
      name: product.name,
      primaryImageUrl: product.primaryImageUrl,
      effectivePrice: product.effectivePrice,
      currency: product.currency,
    });
    if (!result.ok && result.reason === 'full') {
      toast.error('You can compare at most 5 products.');
      return;
    }
    toast.success(inCompare ? 'Removed from compare.' : 'Added to compare.');
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
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = resolveProductImageUrl(null, 0);
              }}
            />
          </figure>
        </Link>
      </div>
      <div className="product-item-action">
        <ul>
          <li>
            <button
              type="button"
              className={`product-card-cart-btn${inWishlist ? ' is-wishlisted' : ''}`}
              title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={inWishlist}
              disabled={wishlistPending || wishlistBusy}
              onClick={(e) => void handleWishlist(e)}
            >
              <img src="/theme/images/icon-wishlist-primary.svg" alt="" />
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`product-card-cart-btn${inCompare ? ' is-compare-selected' : ''}`}
              title={inCompare ? 'Remove from compare' : 'Add to compare'}
              aria-label={inCompare ? 'Remove from compare' : 'Add to compare'}
              aria-pressed={inCompare}
              onClick={handleCompare}
            >
              <img src="/theme/images/icon-compare-primary.svg" alt="" />
            </button>
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
