import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { useFollowedShops } from '../../hooks/useFollow';
import { useToastMessage } from '../../hooks/useToastMessage';

const PLACEHOLDER_LOGO = '/theme/images/icon-about-us-item-1.svg';
const PAGE_SIZE = 20;

export function FollowingPage() {
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
    unfollowShop,
    getErrorMessage,
  } = useFollowedShops(query, { autoLoad: true });

  useToastMessage(error);

  async function handleUnfollow(shopId: string) {
    setBusyId(shopId);
    try {
      await unfollowShop(shopId);
      toast.success('Shop unfollowed.');
      if (items.length <= 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await refresh();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to unfollow shop.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="follow-content-box">
      {loading && items.length === 0 ? <p className="account-muted">Loading followed shops…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="buyer-orders-empty">
          <p>You are not following any shops yet.</p>
          <Link to="/products" className="btn-default">
            Browse shops
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <p className="account-muted follow-count-label">
            {totalCount} {totalCount === 1 ? 'shop' : 'shops'}
          </p>

          <div className="follow-shop-list">
            {items.map((shop) => {
              const busy = busyId === shop.shopId || mutating;
              const shopPath = `/shops/${encodeURIComponent(shop.slug || shop.shopId)}`;

              return (
                <article className="follow-shop-card" key={shop.shopId}>
                  <Link to={shopPath} className="follow-shop-card__media">
                    <img src={shop.logoUrl || PLACEHOLDER_LOGO} alt={shop.shopName} />
                  </Link>

                  <div className="follow-shop-card__body">
                    <div className="follow-shop-card__title">
                      <h3>
                        <Link to={shopPath}>{shop.shopName}</Link>
                      </h3>
                      {shop.isVerified ? <span className="follow-shop-badge">Verified</span> : null}
                    </div>

                    {(shop.tagline || shop.shortDescription) && (
                      <p className="follow-shop-card__tagline">
                        {shop.tagline || shop.shortDescription}
                      </p>
                    )}

                    <div className="follow-shop-card__stats">
                      <span>★ {shop.avgRating.toFixed(1)}</span>
                      <span>{shop.ratingCount} ratings</span>
                      <span>{shop.productCount} products</span>
                      <span>{shop.followerCount} followers</span>
                    </div>
                  </div>

                  <div className="follow-shop-card__actions">
                    <Link to={shopPath} className="btn-default btn-accent btn-border">
                      Visit shop
                    </Link>
                    <button
                      type="button"
                      className="btn-default btn-border follow-unfollow-btn"
                      disabled={busy}
                      onClick={() => void handleUnfollow(shop.shopId)}
                    >
                      Unfollow
                    </button>
                  </div>
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

          <div className="follow-content-button">
            <Link to="/products" className="btn-default">
              Browse products
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
