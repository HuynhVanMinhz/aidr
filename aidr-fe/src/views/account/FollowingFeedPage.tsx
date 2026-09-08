import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../../components/catalog/ProductCard';
import { getFollowingFeed, requireFollowingFeed } from '../../services/followFeedApi';
import type { FollowFeedItem } from '../../types/v2Features';
import { formatDateVi, formatMoney } from '../../utils/formatCatalog';

const PAGE_SIZE = 20;

function FeedItemCard({ item }: { item: FollowFeedItem }) {
  const shopPath = `/shops/${encodeURIComponent(item.shopSlug || item.shopId)}`;

  if (item.itemType === 'Voucher' && item.voucher) {
    const voucher = item.voucher;
    const discountLabel =
      voucher.discountType.toLowerCase() === 'percent'
        ? `${voucher.discountValue}% off`
        : formatMoney(voucher.discountValue, 'VND');

    return (
      <article className="follow-feed-item follow-feed-item--voucher">
        <p className="follow-feed-item__meta">
          <Link to={shopPath}>{item.shopName}</Link>
          {' · '}
          New voucher · {formatDateVi(item.createdAt)}
        </p>
        <h3 className="follow-feed-item__title">{voucher.name}</h3>
        <p className="follow-feed-item__code">
          Code <strong>{voucher.code}</strong> · {discountLabel}
        </p>
        {voucher.description ? <p className="follow-feed-item__desc">{voucher.description}</p> : null}
        <p className="follow-feed-item__terms">
          Min order {formatMoney(voucher.minOrderAmount, 'VND')}
          {voucher.maxDiscountAmount != null
            ? ` · Max discount ${formatMoney(voucher.maxDiscountAmount, 'VND')}`
            : ''}
          {' · '}
          Valid until {formatDateVi(voucher.endsAt)}
        </p>
        <Link to={shopPath} className="account-btn account-btn--primary account-btn--sm">
          Visit shop
        </Link>
      </article>
    );
  }

  if (item.product) {
    return (
      <article className="follow-feed-item follow-feed-item--product">
        <p className="follow-feed-item__meta">
          <Link to={shopPath}>{item.shopName}</Link>
          {' · '}
          New product · {formatDateVi(item.createdAt)}
        </p>
        <ProductCard product={item.product} variant="list" />
      </article>
    );
  }

  return null;
}

export function FollowingFeedPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<FollowFeedItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getFollowingFeed(page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        const feed = requireFollowingFeed(result);
        setItems(feed.items);
        setTotalPages(feed.totalPages);
        setTotalCount(feed.totalCount);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load shop feed.');
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="account-page follow-feed-page">
      <div className="account-toolbar">
        <p className="account-count">
          Updates from shops you follow
          {totalCount > 0 ? ` · ${totalCount} item${totalCount === 1 ? '' : 's'}` : ''}
        </p>
        <Link to="/account/following" className="account-btn account-btn--ghost account-btn--sm">
          Manage following
        </Link>
      </div>

      {error ? (
        <div className="account-empty">
          <p>{error}</p>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="account-muted">Loading shop feed…</p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="account-empty">
          <p>No updates yet from shops you follow.</p>
          <Link to="/account/following" className="account-btn account-btn--primary">
            Browse followed shops
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="follow-feed-list">
          {items.map((item, index) => (
            <li key={`${item.itemType}-${item.createdAt}-${index}`}>
              <FeedItemCard item={item} />
            </li>
          ))}
        </ul>
      ) : null}

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
    </div>
  );
}
