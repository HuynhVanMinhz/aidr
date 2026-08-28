import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { useWishlist } from '../../hooks/useWishlist';
import { resolveProductImageUrl } from '../../utils/catalogImage';
import { discountPercent, formatMoney } from '../../utils/formatCatalog';

const PAGE_SIZE = 20;

export function WishlistPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useMemo(() => ({ page, pageSize: PAGE_SIZE }), [page]);
  const {
    items,
    totalCount,
    totalPages,
    loading,
    mutating,
    error,
    refresh,
    removeItem,
    getErrorMessage,
  } = useWishlist(query, { autoLoad: true });

  const { addItem: addToCart, getErrorMessage: getCartError } = useCart();

  async function handleRemove(wishlistItemId: string) {
    setBusyId(wishlistItemId);
    try {
      await removeItem(wishlistItemId);
      toast.success('Removed from wishlist.');
      if (items.length <= 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await refresh();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to remove product from wishlist.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddToCart(productId: string, wishlistItemId: string, available: boolean) {
    if (!available) {
      toast.error('Product is not available.');
      return;
    }
    setBusyId(wishlistItemId);
    try {
      await addToCart(productId, 1);
      toast.success('Added to cart.');
    } catch (err) {
      toast.error(getCartError(err, 'Unable to add item to cart.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="wishlist-content-box">
      {error ? (
        <div className="alert alert-danger buyer-orders-alert" role="alert">
          {error}
        </div>
      ) : null}

      {loading && items.length === 0 ? <p className="account-muted">Loading wishlist…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="buyer-orders-empty">
          <p>Your wishlist is empty.</p>
          <Link to="/products" className="btn-default">
            Back to Shop
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <p className="wishlist-toolbar__summary">
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </p>

          <div className="wishlist-grid">
            {items.map((item, index) => {
              const off = discountPercent(item.basePrice, item.salePrice);
              const busy = busyId === item.wishlistItemId || mutating;
              const imageUrl = resolveProductImageUrl(item.primaryImageUrl, index);

              return (
                <article className="wishlist-card" key={item.wishlistItemId}>
                  <div className="wishlist-card__media">
                    <div className="wishlist-card__corner-actions">
                      <span
                        className="wishlist-card__heart"
                        title="In your wishlist"
                        aria-label="In your wishlist"
                      >
                        <img src="/theme/images/icon-wishlist-primary.svg" alt="" />
                      </span>
                      <button
                        type="button"
                        className="wishlist-card__remove"
                        aria-label="Remove from wishlist"
                        title="Remove from wishlist"
                        disabled={busy}
                        onClick={() => void handleRemove(item.wishlistItemId)}
                      >
                        <i className="fa-regular fa-trash-can" aria-hidden />
                      </button>
                    </div>
                    <Link
                      to={`/products/${item.productId}`}
                      className="wishlist-card__image"
                      aria-label={item.productName}
                    >
                      <img
                        src={imageUrl}
                        alt={item.productName}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = resolveProductImageUrl(null, index);
                        }}
                      />
                    </Link>
                  </div>

                  <div className="wishlist-card__body">
                    <h3 className="wishlist-card__name">
                      <Link to={`/products/${item.productId}`}>{item.productName}</Link>
                    </h3>
                    <p className="wishlist-card__seller">
                      <Link to={`/shops/${item.shopId}`}>{item.shopName}</Link>
                    </p>
                    <div className="wishlist-card__price">
                      <span className="wishlist-card__price-current">
                        {formatMoney(item.effectivePrice, item.currency)}
                      </span>
                      {item.salePrice != null && item.salePrice < item.basePrice ? (
                        <span className="wishlist-card__price-old">
                          {formatMoney(item.basePrice, item.currency)}
                        </span>
                      ) : null}
                      {off != null ? (
                        <span className="wishlist-card__discount">{off}% OFF</span>
                      ) : null}
                    </div>
                    <p
                      className={`wishlist-card__stock${
                        item.isAvailable ? ' is-in-stock' : ' is-out-of-stock'
                      }`}
                    >
                      {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-default btn-accent wishlist-card__cta"
                    disabled={busy || !item.isAvailable}
                    onClick={() =>
                      void handleAddToCart(item.productId, item.wishlistItemId, item.isAvailable)
                    }
                  >
                    Add to cart
                  </button>
                </article>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <div className="buyer-orders-pagination">
              <button
                type="button"
                className="btn-default btn-accent btn-border"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-default btn-accent btn-border"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}

          <div className="wishlist-content-button">
            <Link to="/products" className="btn-default">
              Back to Shop
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
