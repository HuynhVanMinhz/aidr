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
    <div className="account-page">
      {loading && items.length === 0 ? <p className="account-muted">Loading followed shops…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="account-empty">
          <p>You are not following any shops yet.</p>
          <Link to="/products" className="account-btn account-btn--primary">
            Browse shops
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="account-toolbar">
            <p className="account-count">
              {totalCount} {totalCount === 1 ? 'shop' : 'shops'} followed
            </p>
          </div>

          <ul className="account-stack">
            {items.map((shop) => {
              const busy = busyId === shop.shopId || mutating;
              const shopPath = `/shops/${encodeURIComponent(shop.slug || shop.shopId)}`;

              return (
                <li key={shop.shopId}>
                  <article className="shop-card">
                    <Link to={shopPath} className="shop-card__media">
                      <img
                        src={shop.logoUrl || PLACEHOLDER_LOGO}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallback === '1') return;
                          img.dataset.fallback = '1';
                          img.src = PLACEHOLDER_LOGO;
                        }}
                      />
                    </Link>

                    <div className="shop-card__body">
                      <h3 className="shop-card__title">
                        <Link to={shopPath}>{shop.shopName}</Link>
                        {shop.isVerified ? (
                          <span className="shop-card__badge">
                            <i className="fa-solid fa-circle-check" aria-hidden />
                            Verified
                          </span>
                        ) : null}
                      </h3>

                      {shop.tagline || shop.shortDescription ? (
                        <p className="shop-card__tagline">
                          {shop.tagline || shop.shortDescription}
                        </p>
                      ) : null}

                      <p className="shop-card__stats">
                        {shop.ratingCount > 0 ? (
                          <span className="is-rating">
                            <i className="fa-solid fa-star" aria-hidden /> {shop.avgRating.toFixed(1)}
                            {' '}({shop.ratingCount})
                          </span>
                        ) : (
                          <span>No ratings yet</span>
                        )}
                        <span>{shop.productCount} products</span>
                        <span>
                          {shop.followerCount} follower{shop.followerCount === 1 ? '' : 's'}
                        </span>
                      </p>
                    </div>

                    <div className="shop-card__actions">
                      <Link to={shopPath} className="account-btn account-btn--primary account-btn--sm">
                        Visit shop
                      </Link>
                      <button
                        type="button"
                        className="account-btn account-btn--secondary account-btn--sm"
                        disabled={busy}
                        onClick={() => void handleUnfollow(shop.shopId)}
                      >
                        {busy ? 'Working…' : 'Unfollow'}
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <div className="account-pagination">
              <button
                type="button"
                className="account-btn account-btn--secondary account-btn--sm"
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
                className="account-btn account-btn--secondary account-btn--sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}

        </>
      ) : null}
    </div>
  );
}
