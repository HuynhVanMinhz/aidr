import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { useWishlist } from '../../hooks/useWishlist';
import { discountPercent, formatMoney } from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';
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
        <div className="alert alert-danger" role="alert">
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
          <p className="account-muted wishlist-count-label">
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </p>

          <div className="wishlist-item-table">
            <div className="wishlist-item-header">
              <span className="wishlist-product-tag">Product</span>
              <span className="wishlist-price-tag">Unit Price</span>
              <span className="wishlist-status-tag">Stock Status</span>
              <span className="wishlist-action-tag">Action</span>
            </div>

            {items.map((item) => {
              const off = discountPercent(item.basePrice, item.salePrice);
              const busy = busyId === item.wishlistItemId || mutating;
              const imageUrl = item.primaryImageUrl || PLACEHOLDER;

              return (
                <div className="wishlist-item" key={item.wishlistItemId}>
                  <div className="wishlist-item-image-content">
                    <div className="wishlist-item-image">
                      <figure>
                        <Link to={`/products/${item.productId}`}>
                          <img src={imageUrl} alt={item.productName} />
                        </Link>
                      </figure>
                    </div>
                    <div className="wishlist-item-info-content">
                      <div className="wishlist-item-title">
                        <p>
                          <Link to={`/products/${item.productId}`}>{item.productName}</Link>
                        </p>
                        <p>
                          <Link to={`/shops/${item.shopId}`}>{item.shopName}</Link>
                        </p>
                      </div>
                      <div className="wishlist-item-price">
                        <p>
                          {item.salePrice != null && item.salePrice < item.basePrice ? (
                            <>
                              <span>{formatMoney(item.basePrice, item.currency)}</span>{' '}
                              {formatMoney(item.effectivePrice, item.currency)}
                            </>
                          ) : (
                            formatMoney(item.effectivePrice, item.currency)
                          )}
                        </p>
                        {off != null ? <p>{off}% OFF</p> : null}
                      </div>
                    </div>
                  </div>

                  <div className="wishlist-item-status-action">
                    <div className="wishlist-item-status">
                      <p>{item.isAvailable ? 'In Stock' : 'Out of Stock'}</p>
                    </div>
                    <div className="wishlist-item-action wishlist-item-action--row">
                      <button
                        type="button"
                        className="btn-default btn-accent btn-border wishlist-add-cart-btn"
                        disabled={busy || !item.isAvailable}
                        onClick={() =>
                          void handleAddToCart(item.productId, item.wishlistItemId, item.isAvailable)
                        }
                      >
                        Add to cart
                      </button>
                      <button
                        type="button"
                        className="wishlist-remove-btn"
                        aria-label="Remove from wishlist"
                        title="Remove"
                        disabled={busy}
                        onClick={() => void handleRemove(item.wishlistItemId)}
                      >
                        <i className="fa-regular fa-trash-can" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
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
