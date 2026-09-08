import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { ProductCard } from '../../components/catalog/ProductCard';
import { SORT_OPTIONS } from '../../components/catalog/ProductFilters';
import { useFollowShop } from '../../hooks/useFollow';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearShop,
  defaultShopProductFilters,
  fetchShop,
  fetchShopRating,
  selectShop,
  selectShopError,
  selectShopFilters,
  selectShopLoading,
  selectShopRating,
  selectShopRatingError,
  selectShopRatingLoading,
  type ShopProductFilters,
} from '../../store/shopSlice';
import type { ProductSort } from '../../types/catalog';
import { OPENING_HOURS_DAYS } from '../../utils/structuredJson';
import type { ShopPublicAddress, ShopPublicContact } from '../../types/shop';

type ShopTab = 'about' | 'policies' | 'rating';

const PLACEHOLDER_BANNER = '/theme/images/about-us-image.jpg';
const PLACEHOLDER_LOGO = '/theme/images/icon-about-us-item-1.svg';

function parseFilters(params: URLSearchParams): ShopProductFilters {
  const sortRaw = params.get('sort') || 'newest';
  const allowed: ProductSort[] = ['newest', 'price_asc', 'price_desc', 'popular', 'rating'];
  const sort = allowed.includes(sortRaw as ProductSort) ? (sortRaw as ProductSort) : 'newest';
  const pageRaw = params.get('page');
  const page = pageRaw && Number(pageRaw) > 0 ? Number(pageRaw) : 1;
  return {
    q: params.get('q') ?? '',
    sort,
    page,
    pageSize: defaultShopProductFilters.pageSize,
  };
}

function filtersToSearchParams(filters: ShopProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

function formatAddress(address: ShopPublicAddress): string | null {
  const parts = [
    address.streetAddress,
    address.ward,
    address.district,
    address.province,
  ].filter((p): p is string => Boolean(p?.trim()));
  return parts.length ? parts.join(', ') : null;
}

function hasContact(contact: ShopPublicContact): boolean {
  return Boolean(
    contact.email?.trim() ||
      contact.phone?.trim() ||
      contact.hotline?.trim() ||
      contact.websiteUrl?.trim() ||
      contact.facebookUrl?.trim(),
  );
}

const DAY_LABELS = new Map<string, string>(
  OPENING_HOURS_DAYS.map((day) => [day.key, day.label]),
);

/**
 * Sellers now pick days in a weekly grid, so the keys are `mon`..`sun` and can
 * be shown as day names in week order. Anything older is still rendered, just
 * with its raw key, after the days we recognise.
 */
function parseOpeningHours(json?: string | null): { day: string; hours: string }[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const rows = Object.entries(parsed)
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .map(([key, hours]) => ({
        key: key.trim().toLowerCase(),
        day: DAY_LABELS.get(key.trim().toLowerCase()) ?? key,
        hours: String(hours),
      }));

    const order = OPENING_HOURS_DAYS.map((d) => d.key as string);
    return rows
      .sort((a, b) => {
        const ai = order.indexOf(a.key);
        const bi = order.indexOf(b.key);
        return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
      })
      .map(({ day, hours }) => ({ day, hours }));
  } catch {
    return [];
  }
}

export function ShopPublicPage() {
  const { shopKey = '' } = useParams<{ shopKey: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const shop = useAppSelector(selectShop);
  const rating = useAppSelector(selectShopRating);
  const loading = useAppSelector(selectShopLoading);
  const ratingLoading = useAppSelector(selectShopRatingLoading);
  const error = useAppSelector(selectShopError);
  const ratingError = useAppSelector(selectShopRatingError);
  useToastMessage(error);
  const filters = useAppSelector(selectShopFilters);
  const [tab, setTab] = useState<ShopTab>('about');
  const [draftQ, setDraftQ] = useState('');
  const [followerCountOverride, setFollowerCountOverride] = useState<number | null>(null);
  const [followPending, setFollowPending] = useState(false);

  const shopId = shop?.shopId;
  const {
    isFollowing,
    mutating: followMutating,
    isAuthenticated,
    followShop: followShopAction,
    unfollowShop: unfollowShopAction,
    getErrorMessage: getFollowError,
  } = useFollowShop(shopId);

  const searchKey = searchParams.toString();
  const urlFilters = useMemo(
    () => parseFilters(new URLSearchParams(searchKey)),
    [searchKey],
  );

  useEffect(() => {
    setDraftQ(urlFilters.q);
  }, [urlFilters.q]);

  useEffect(() => {
    if (!shopKey.trim()) return;
    void dispatch(fetchShop({ shopKey, filters: urlFilters }));
  }, [dispatch, shopKey, urlFilters]);

  useEffect(() => {
    if (!shopKey.trim()) return;
    void dispatch(fetchShopRating(shopKey));
  }, [dispatch, shopKey]);

  useEffect(() => {
    return () => {
      dispatch(clearShop());
    };
  }, [dispatch]);

  useEffect(() => {
    setFollowerCountOverride(null);
  }, [shopKey, shopId]);

  function syncUrl(next: ShopProductFilters) {
    setSearchParams(filtersToSearchParams(next), { replace: false });
  }

  const displayRating = rating ?? (shop
    ? {
        shopId: shop.shopId,
        shopName: shop.shopName,
        slug: shop.slug,
        avgRating: shop.avgRating,
        ratingCount: shop.ratingCount,
      }
    : null);

  const openingHours = parseOpeningHours(shop?.openingHoursJson);
  const addressText = shop ? formatAddress(shop.address) : null;
  const products = shop?.products.items ?? [];
  const paging = shop?.products;
  const displayFollowerCount = followerCountOverride ?? shop?.followerCount ?? 0;
  const followBusy = followPending || followMutating;

  async function handleFollowToggle() {
    if (!shopId) return;
    if (!isAuthenticated) {
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setFollowPending(true);
    try {
      if (isFollowing) {
        await unfollowShopAction();
        setFollowerCountOverride(Math.max(0, displayFollowerCount - 1));
        toast.success('Shop unfollowed.');
      } else {
        const followed = await followShopAction();
        setFollowerCountOverride(followed.followerCount);
        toast.success('Shop followed.');
      }
    } catch (err) {
      toast.error(getFollowError(err, 'Unable to update follow status.'));
    } finally {
      setFollowPending(false);
    }
  }

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>{shop?.shopName ?? (loading ? 'Loading…' : 'Shop')}</h1>
                <CatalogBreadcrumb
                  items={[
                    { label: 'Home', to: '/' },
                    { label: 'Products', to: '/products' },
                    { label: shop?.shopName ?? 'Shop' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="container">
          <div className="page-state">
            <p className="page-state__title">Shop not available</p>
            <p className="page-state__text">
              This shop could not be loaded. It may have been closed or the link is out of date.
            </p>
            <Link to="/products" className="btn-default">
              Browse products
            </Link>
          </div>
        </div>
      )}

      {!error && (
        <>
          <div className="about-us shop-public-hero">
            <div className="container">
              <div className="row align-items-center">
                <div className="col-xl-5 col-lg-5">
                  <div className="about-us-image shop-public-hero__media">
                    {shop?.bannerUrl ? (
                      <figure className="image-anime">
                        <img src={shop.bannerUrl} alt="" />
                      </figure>
                    ) : (
                      <figure className="image-anime">
                        <img src={PLACEHOLDER_BANNER} alt="" />
                      </figure>
                    )}
                    <div className="shop-public-logo">
                      <img
                        src={shop?.logoUrl || PLACEHOLDER_LOGO}
                        alt={shop?.shopName ?? 'Shop logo'}
                      />
                    </div>
                  </div>
                </div>

                <div className="col-xl-7 col-lg-7">
                  <div className="about-us-content">
                    <div className="section-title">
                      <span className="section-sub-title">
                        {shop?.isVerified ? 'Verified seller' : 'Seller'}
                      </span>
                      <h2>{shop?.shopName ?? '—'}</h2>
                      {shop?.tagline && <p>{shop.tagline}</p>}
                      {!shop?.tagline && shop?.shortDescription && <p>{shop.shortDescription}</p>}
                    </div>

                    <div className="shop-public-stats">
                      <div className="shop-public-stat">
                        <strong>
                          {ratingLoading && !displayRating
                            ? '…'
                            : `★ ${(displayRating?.avgRating ?? 0).toFixed(1)}`}
                        </strong>
                        <span>
                          {displayRating?.ratingCount ?? 0} rating
                          {(displayRating?.ratingCount ?? 0) === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="shop-public-stat">
                        <strong>{shop?.productCount ?? 0}</strong>
                        <span>Products</span>
                      </div>
                      <div className="shop-public-stat">
                        <strong>{displayFollowerCount}</strong>
                        <span>Followers</span>
                      </div>
                    </div>

                    {shop?.badges && shop.badges.length > 0 ? (
                      <ul className="shop-trust-badges" aria-label="Shop trust badges">
                        {shop.badges.map((badge) => (
                          <li key={badge.code} className="shop-trust-badge" title={badge.description}>
                            <i className="fa-solid fa-shield-halved" aria-hidden />
                            <span>{badge.label}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="shop-public-follow-row">
                      <button
                        type="button"
                        className={`btn-default${isFollowing ? ' btn-border' : ''}`}
                        disabled={followBusy || !shop}
                        onClick={() => void handleFollowToggle()}
                      >
                        {followBusy
                          ? 'Updating…'
                          : isFollowing
                            ? 'Following'
                            : 'Follow shop'}
                      </button>
                      {shop ? (
                        <Link
                          to={
                            isAuthenticated
                              ? `/chat?shopId=${encodeURIComponent(shop.shopId)}`
                              : `/login?returnUrl=${encodeURIComponent(`/chat?shopId=${shop.shopId}`)}`
                          }
                          className="btn-default btn-border"
                        >
                          Chat with shop
                        </Link>
                      ) : null}
                      {isAuthenticated ? (
                        <Link to="/account/following" className="shop-public-following-link">
                          View followed shops
                        </Link>
                      ) : null}
                    </div>

                    {ratingError && (
                      <p className="text-muted shop-public-rating-hint">{ratingError}</p>
                    )}

                    {addressText && (
                      <p className="shop-public-meta">
                        <span>Location:</span> {addressText}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="page-products shop-public-body">
            <div className="container">
              <div className="product-single-review-box shop-public-tabs">
                <div className="product-step-nav">
                  <ul className="nav nav-tabs" role="tablist">
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        className={`nav-link${tab === 'about' ? ' active' : ''}`}
                        onClick={() => setTab('about')}
                      >
                        About
                      </button>
                    </li>
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        className={`nav-link${tab === 'policies' ? ' active' : ''}`}
                        onClick={() => setTab('policies')}
                      >
                        Policies
                      </button>
                    </li>
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        className={`nav-link${tab === 'rating' ? ' active' : ''}`}
                        onClick={() => setTab('rating')}
                      >
                        Rating
                      </button>
                    </li>
                  </ul>
                </div>

                {tab === 'about' && (
                  <div className="product-tab-item-box">
                    <div className="product-tab-item-content">
                      {shop?.description ? (
                        <p style={{ whiteSpace: 'pre-wrap' }}>{shop.description}</p>
                      ) : shop?.shortDescription ? (
                        <p style={{ whiteSpace: 'pre-wrap' }}>{shop.shortDescription}</p>
                      ) : (
                        <p className="text-muted">No shop description yet.</p>
                      )}

                      {shop && hasContact(shop.contact) && (
                        <ul className="shop-public-contact">
                          {shop.contact.hotline && (
                            <li>
                              <span>Hotline:</span> {shop.contact.hotline}
                            </li>
                          )}
                          {shop.contact.phone && (
                            <li>
                              <span>Phone:</span> {shop.contact.phone}
                            </li>
                          )}
                          {shop.contact.email && (
                            <li>
                              <span>Email:</span> {shop.contact.email}
                            </li>
                          )}
                          {shop.contact.websiteUrl && (
                            <li>
                              <span>Website:</span>{' '}
                              <a href={shop.contact.websiteUrl} target="_blank" rel="noreferrer">
                                {shop.contact.websiteUrl}
                              </a>
                            </li>
                          )}
                          {shop.contact.facebookUrl && (
                            <li>
                              <span>Facebook:</span>{' '}
                              <a href={shop.contact.facebookUrl} target="_blank" rel="noreferrer">
                                {shop.contact.facebookUrl}
                              </a>
                            </li>
                          )}
                        </ul>
                      )}

                      {openingHours.length > 0 && (
                        <div className="shop-public-hours">
                          <h3>Opening hours</h3>
                          <ul>
                            {openingHours.map((row) => (
                              <li key={row.day}>
                                <span>{row.day}</span> {row.hours}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'policies' && (
                  <div className="product-tab-item-box">
                    <div className="product-tab-item-content">
                      <h3>Return policy</h3>
                      <p style={{ whiteSpace: 'pre-wrap' }}>
                        {shop?.returnPolicy?.trim() || 'No return policy published yet.'}
                      </p>
                      <h3 className="mt-4">Shipping policy</h3>
                      <p style={{ whiteSpace: 'pre-wrap' }}>
                        {shop?.shippingPolicy?.trim() || 'No shipping policy published yet.'}
                      </p>
                    </div>
                  </div>
                )}

                {tab === 'rating' && (
                  <div className="product-tab-item-box">
                    <div className="product-tab-item-content shop-public-rating-panel">
                      {ratingLoading && !displayRating ? (
                        <p>Loading rating…</p>
                      ) : (
                        <>
                          <div className="shop-public-rating-score">
                            <strong>★ {(displayRating?.avgRating ?? 0).toFixed(1)}</strong>
                            <span>out of 5</span>
                          </div>
                          <p>
                            Based on {displayRating?.ratingCount ?? 0} seller rating
                            {(displayRating?.ratingCount ?? 0) === 1 ? '' : 's'}.
                          </p>
                          {(displayRating?.ratingCount ?? 0) === 0 && (
                            <p className="text-muted mb-0">
                              This shop has not received buyer ratings yet.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="product-item-list-box mt-5">
                <div className="product-category-filter-header">
                  <div className="product-category-filter-title">
                    <h2>
                      {loading
                        ? 'Loading products…'
                        : `Shop products (${paging?.totalCount ?? 0})`}
                    </h2>
                  </div>
                  <div className="product-category-result-info shop-public-toolbar">
                    <form
                      className="shop-public-search"
                      onSubmit={(e) => {
                        e.preventDefault();
                        syncUrl({ ...urlFilters, q: draftQ, page: 1 });
                      }}
                    >
                      <input
                        type="search"
                        className="form-control"
                        placeholder="Search in this shop"
                        value={draftQ}
                        onChange={(e) => setDraftQ(e.target.value)}
                        aria-label="Search in this shop"
                      />
                      <button type="submit" className="btn-default btn-border">
                        Search
                      </button>
                    </form>
                    <div className="product-category-sorting-list">
                      <select
                        className="form-control form-select"
                        value={filters.sort}
                        onChange={(e) => {
                          const sort = e.target.value as ProductSort;
                          syncUrl({ ...urlFilters, sort, page: 1 });
                        }}
                        aria-label="Sort products"
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {!loading && products.length === 0 && (
                  <p className="text-muted">No approved products in this shop yet.</p>
                )}

                <div className="product-item-list">
                  {products.map((product) => (
                    <ProductCard key={product.productId} product={product} variant="list" />
                  ))}
                </div>

                {paging && paging.totalPages > 1 && (
                  <div className="product-learn-more-btn catalog-pager">
                    <button
                      type="button"
                      className="btn-default btn-border"
                      disabled={paging.page <= 1 || loading}
                      onClick={() => syncUrl({ ...urlFilters, page: paging.page - 1 })}
                    >
                      Previous
                    </button>
                    <span className="catalog-pager__label">
                      Page {paging.page} / {paging.totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn-default"
                      disabled={paging.page >= paging.totalPages || loading}
                      onClick={() => syncUrl({ ...urlFilters, page: paging.page + 1 })}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
