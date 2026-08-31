import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { ProductAdditionalInfo } from '../../components/catalog/ProductAdditionalInfo';
import { ProductVariantPicker } from '../../components/catalog/ProductVariantPicker';
import { SimilarProductsSection } from '../../components/catalog/SimilarProductsSection';
import { ProductReviewsPanel } from '../../components/reviews/ProductReviewsPanel';
import { useAuth } from '../../hooks/useAuth';
import { useCompare } from '../../hooks/useAi';
import { useProductDetail } from '../../hooks/useCatalog';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
import { useWishlistProduct } from '../../hooks/useWishlist';
import {
  discountPercent,
  formatMoney,
  parseSpecsJson,
  parseTagsJson,
} from '../../utils/formatCatalog';
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from '../../utils/catalogImage';
import {
  defaultSelection,
  findSelectedVariant,
  type VariantSelection,
} from '../../utils/productVariants';

const PLACEHOLDER = PRODUCT_IMAGE_PLACEHOLDER;
const MAX_QTY = 99;

function StarRow({ rating, showValue }: { rating: number; showValue?: boolean }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <div className="customer-review-item-rating catalog-detail-rating">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'catalog-star is-on' : 'catalog-star'} aria-hidden>
          ★
        </span>
      ))}
      {showValue && (
        <span className="catalog-detail-rating__value">
          {rating.toFixed(1)} ({rating > 0 ? 'rated' : 'no ratings'})
        </span>
      )}
    </div>
  );
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { product, loading, error } = useProductDetail(id);
  useToastMessage(error);
  const { addItem, buyNow, mutating, getErrorMessage } = useCart({ autoLoad: isAuthenticated });
  const {
    inWishlist,
    toggle: toggleWishlist,
    mutating: wishlistBusy,
    getErrorMessage: getWishlistError,
  } = useWishlistProduct(id);
  const { toggle: toggleCompare, isSelected } = useCompare();
  const inCompare = Boolean(id && isSelected(id));
  const toast = useToast();
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<'description' | 'specs' | 'reviews'>('description');
  const [qty, setQty] = useState(1);
  const [selection, setSelection] = useState<VariantSelection>({});
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [wishlistPending, setWishlistPending] = useState(false);

  const images = useMemo(() => {
    if (!product) return [];
    if (product.images.length > 0) {
      return product.images.map((img, index) => ({
        ...img,
        imageUrl: resolveProductImageUrl(img.imageUrl, index),
      }));
    }
    return [{ productImageId: 'placeholder', imageUrl: PLACEHOLDER, sortOrder: 0, isPrimary: true }];
  }, [product]);

  const specs = useMemo(() => parseSpecsJson(product?.specsJson), [product?.specsJson]);
  const tags = useMemo(() => parseTagsJson(product?.tagsJson), [product?.tagsJson]);

  const variantOptions = product?.variantOptions ?? [];
  const variants = product?.variants ?? [];
  const hasVariants = variantOptions.length > 0 && variants.length > 0;

  // Land the shopper on a real, in-stock configuration rather than an empty picker.
  useEffect(() => {
    if (!product) return;
    setSelection(defaultSelection(product.variants ?? [], product.variantOptions ?? []));
    setQty(1);
  }, [product]);

  const selectedVariant = useMemo(
    () => findSelectedVariant(variants, variantOptions, selection),
    [variants, variantOptions, selection],
  );

  if (loading) {
    return (
      <div className="page-product-single">
        <div className="container">
          <p>Loading product…</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-product-single">
        <div className="container">
          <div className="page-state">
            <p className="page-state__title">Product not available</p>
            <p className="page-state__text">
              This product could not be loaded. It may have been removed or is no longer published.
            </p>
            <Link to="/products" className="btn-default btn-accent">
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const detail = product;
  // A variant's own image wins over the gallery, so picking "Orange" changes the photo.
  const mainImage =
    selectedVariant?.imageUrl ??
    images[Math.min(activeImage, images.length - 1)]?.imageUrl ??
    PLACEHOLDER;

  // With variants the product's own price and stock only describe its cheapest one; every
  // figure the buyer acts on has to come from the configuration actually selected.
  const listPrice = selectedVariant ? selectedVariant.price : detail.basePrice;
  const currentPrice = selectedVariant ? selectedVariant.effectivePrice : detail.effectivePrice;
  const comparePrice = selectedVariant ? selectedVariant.salePrice : detail.salePrice;
  const availableQuantity = selectedVariant
    ? selectedVariant.availableQuantity
    : detail.availableQuantity;
  const stockQuantity = selectedVariant ? selectedVariant.stockQuantity : detail.stockQuantity;

  const off = discountPercent(listPrice, comparePrice);
  const maxQty = Math.min(MAX_QTY, Math.max(1, availableQuantity));
  const safeQty = Math.min(Math.max(1, qty), maxQty);
  // An incomplete selection is not buyable, and neither is a sold-out configuration.
  const awaitingVariant = hasVariants && !selectedVariant;
  const outOfStock = availableQuantity < 1;
  const cannotBuy = awaitingVariant || outOfStock;
  const addBusy = adding || buying || mutating;
  const productId = detail.productId;
  const priceRangeLabel =
    hasVariants && detail.maxEffectivePrice > detail.effectivePrice
      ? `${formatMoney(detail.effectivePrice, detail.currency)} – ${formatMoney(detail.maxEffectivePrice, detail.currency)}`
      : null;

  async function handleAddToCart() {
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?returnUrl=${returnUrl}`);
      return;
    }
    if (awaitingVariant) {
      toast.error('Please choose a configuration first.');
      return;
    }
    if (outOfStock) {
      toast.error('This configuration is out of stock.');
      return;
    }

    setAdding(true);
    try {
      await addItem(productId, safeQty, selectedVariant?.variantId);
      toast.success('Added to cart.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to add item to cart.'));
    } finally {
      setAdding(false);
    }
  }

  async function handleBuyNow() {
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?returnUrl=${returnUrl}`);
      return;
    }
    if (awaitingVariant) {
      toast.error('Please choose a configuration first.');
      return;
    }
    if (outOfStock) {
      toast.error('This configuration is out of stock.');
      return;
    }

    setBuying(true);
    try {
      await buyNow(productId, safeQty, selectedVariant?.variantId);
      navigate('/checkout');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to start checkout.'));
    } finally {
      setBuying(false);
    }
  }

  async function handleWishlistToggle() {
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?returnUrl=${returnUrl}`);
      return;
    }

    setWishlistPending(true);
    try {
      await toggleWishlist();
      toast.success(inWishlist ? 'Removed from wishlist.' : 'Added to wishlist.');
    } catch (err) {
      toast.error(getWishlistError(err, 'Unable to update wishlist.'));
    } finally {
      setWishlistPending(false);
    }
  }

  function handleCompareToggle() {
    const result = toggleCompare({
      productId,
      name: detail.name,
      primaryImageUrl: detail.images.find((i) => i.isPrimary)?.imageUrl ?? detail.images[0]?.imageUrl,
      effectivePrice: detail.effectivePrice,
      currency: detail.currency,
    });
    if (!result.ok && result.reason === 'full') {
      toast.error('You can compare at most 5 products.');
      return;
    }
    toast.success(inCompare ? 'Removed from compare.' : 'Added to compare.');
  }

  return (
    <>
      <div className="page-product-single">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-product-single-content">
                <div className="product-single-breadcrumb-list">
                  <CatalogBreadcrumb
                    items={[
                      { label: 'Home', to: '/' },
                      { label: 'Products', to: '/products' },
                      { label: product.name },
                    ]}
                  />
                </div>

              <div className="product-single-info-box">
                <div className="product-single-image-box">
                  {images.length > 1 && (
                    <div className="product-single-image-slider catalog-thumbs">
                      {images.map((img, index) => (
                        <button
                          key={img.productImageId}
                          type="button"
                          className={`catalog-thumb-slide${index === activeImage ? ' is-active' : ''}`}
                          onClick={() => setActiveImage(index)}
                        >
                          <figure>
                            <img src={img.imageUrl} alt="" />
                          </figure>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="product-single-image-item catalog-main-image">
                    <figure className="imgae-anime">
                      <img src={mainImage} alt={product.name} />
                    </figure>
                  </div>
                </div>

                <div className="product-single-info-content">
                  <div className="product-single-title">
                    <h1>{product.name}</h1>
                    <span>
                      <Link to={`/products?categoryId=${product.category.categoryId}`}>
                        {product.category.name}
                      </Link>
                      {product.brand ? ` · ${product.brand}` : ''}
                      {off != null ? ` · ${off}% Off` : ''}
                      {product.isFeatured ? ' · Featured' : ''}
                    </span>
                  </div>

                  <StarRow rating={product.avgRating} showValue />

                  {tags.length > 0 && (
                    <div className="catalog-detail-tags">
                      {tags.map((tag) => (
                        <span key={tag} className="product-item-tag">
                          <Link to={`/products?q=${encodeURIComponent(tag)}`}>{tag}</Link>
                        </span>
                      ))}
                    </div>
                  )}

                  {product.shortDescription && (
                    <div className="product-single-description">
                      <p>{product.shortDescription}</p>
                    </div>
                  )}

                  <div className="product-single-price">
                    <h2>
                      {formatMoney(currentPrice, product.currency)}{' '}
                      {comparePrice != null && comparePrice < listPrice && (
                        <span>{formatMoney(listPrice, product.currency)}</span>
                      )}
                    </h2>
                    {priceRangeLabel && (
                      <p className="product-single-price__range">
                        All configurations: {priceRangeLabel}
                      </p>
                    )}
                  </div>

                  {hasVariants && (
                    <ProductVariantPicker
                      options={variantOptions}
                      variants={variants}
                      selection={selection}
                      onChange={setSelection}
                      disabled={addBusy}
                    />
                  )}

                  <div className="product-single-content-body">
                    <div className="qty-box">
                      <button
                        type="button"
                        className="qty-btn minus"
                        aria-label="Decrease quantity"
                        disabled={safeQty <= 1}
                        onClick={() => setQty((v) => Math.max(1, v - 1))}
                      >
                        -
                      </button>
                      <input
                        type="text"
                        className="qty-input"
                        readOnly
                        value={String(safeQty).padStart(2, '0')}
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        className="qty-btn plus"
                        aria-label="Increase quantity"
                        disabled={safeQty >= maxQty}
                        onClick={() => setQty((v) => Math.min(maxQty, v + 1))}
                      >
                        +
                      </button>
                    </div>
                    <div className="product-single-content-btn">
                      <button
                        type="button"
                        className="btn-default btn-accent"
                        disabled={cannotBuy || addBusy}
                        onClick={() => void handleAddToCart()}
                      >
                        {awaitingVariant
                          ? 'Select a configuration'
                          : outOfStock
                            ? 'Out of Stock'
                            : adding
                              ? 'Adding…'
                              : 'Add To Cart'}
                      </button>
                      <button
                        type="button"
                        className="product-single-buy-now"
                        disabled={cannotBuy || addBusy}
                        onClick={() => void handleBuyNow()}
                      >
                        {buying ? 'Starting…' : 'Buy Now'}
                      </button>
                    </div>
                    <div className="product-single-action">
                      <ul>
                        <li>
                          <button
                            type="button"
                            className={`product-card-cart-btn${inWishlist ? ' is-wishlisted' : ''}`}
                            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                            aria-pressed={inWishlist}
                            title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                            disabled={wishlistPending || wishlistBusy}
                            onClick={() => void handleWishlistToggle()}
                          >
                            <img src="/theme/images/icon-wishlist-primary.svg" alt="" />
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className={`product-card-cart-btn${inCompare ? ' is-compare-selected' : ''}`}
                            aria-label={inCompare ? 'Remove from compare' : 'Add to compare'}
                            aria-pressed={inCompare}
                            title={inCompare ? 'Remove from compare' : 'Add to compare'}
                            onClick={handleCompareToggle}
                          >
                            <img src="/theme/images/icon-compare-primary.svg" alt="" />
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="product-single-content-footer">
                    <div className="product-single-details-list">
                      <ul>
                        {selectedVariant && (
                          <li>
                            <span>Configuration:</span> {selectedVariant.variantName}
                          </li>
                        )}
                        {(selectedVariant?.sku ?? product.modelNumber) && (
                          <li>
                            <span>SKU / Model:</span>{' '}
                            {selectedVariant?.sku ?? product.modelNumber}
                          </li>
                        )}
                        <li>
                          <span>Categories:</span>{' '}
                          <Link to={`/products?categoryId=${product.category.categoryId}`}>
                            {product.category.name}
                          </Link>
                        </li>
                        {product.brand && (
                          <li>
                            <span>Brand:</span> {product.brand}
                          </li>
                        )}
                        <li>
                          <span>Condition:</span> {product.conditionType}
                        </li>
                        <li>
                          <span>Stock:</span>{' '}
                          {awaitingVariant
                            ? 'Select a configuration to see availability'
                            : availableQuantity > 0
                              ? `${availableQuantity} available (${stockQuantity} total)`
                              : 'Out of stock'}
                        </li>
                        {product.originCountry && (
                          <li>
                            <span>Origin:</span> {product.originCountry}
                          </li>
                        )}
                        {product.warrantyMonths != null && (
                          <li>
                            <span>Warranty:</span> {product.warrantyMonths} months
                          </li>
                        )}
                        <li>
                          <span>Shop:</span>{' '}
                          <Link to={`/shops/${encodeURIComponent(product.shop.slug || product.shop.shopId)}`}>
                            {product.shop.shopName}
                          </Link>
                          {product.shop.isVerified ? ' ✓ Verified' : ''}
                        </li>
                      </ul>
                    </div>
                    <div className="product-shipping-box">
                      <ul>
                        <li>
                          <img src="/theme/images/icon-product-shipping-1.svg" alt="" />
                          Delivery & Return
                        </li>
                        <li>
                          <img src="/theme/images/icon-product-shipping-2.svg" alt="" />
                          ★ {product.avgRating.toFixed(1)} · {product.reviewCount} reviews ·{' '}
                          {product.soldCount} sold · {product.viewCount} views
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="catalog-detail-shop">
                    {product.shop.logoUrl && (
                      <img src={product.shop.logoUrl} alt="" className="catalog-detail-shop__logo" />
                    )}
                    <div>
                      <h3>{product.shop.shopName}</h3>
                      <p>
                        Shop rating: ★ {product.shop.avgRating.toFixed(1)} ({product.shop.ratingCount}{' '}
                        ratings)
                        {product.shop.isVerified ? ' · Verified seller' : ''}
                      </p>
                      <Link to={`/shops/${encodeURIComponent(product.shop.slug || product.shop.shopId)}`}>
                        Visit shop
                      </Link>
                      {' · '}
                      <Link
                        to={
                          isAuthenticated
                            ? `/chat?shopId=${encodeURIComponent(product.shop.shopId)}&productId=${encodeURIComponent(product.productId)}`
                            : `/login?returnUrl=${encodeURIComponent(`/chat?shopId=${product.shop.shopId}&productId=${product.productId}`)}`
                        }
                      >
                        Chat with seller
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <div className="product-single-review-box">
                <div className="product-single-review-tab tab-content">
                  <div className="product-step-nav">
                    <ul className="nav nav-tabs" role="tablist">
                      <li className="nav-item" role="presentation">
                        <button
                          type="button"
                          className={`nav-link${tab === 'description' ? ' active' : ''}`}
                          onClick={() => setTab('description')}
                        >
                          Product Description
                        </button>
                      </li>
                      <li className="nav-item" role="presentation">
                        <button
                          type="button"
                          className={`nav-link${tab === 'specs' ? ' active' : ''}`}
                          onClick={() => setTab('specs')}
                        >
                          Additional Information
                        </button>
                      </li>
                      <li className="nav-item" role="presentation">
                        <button
                          type="button"
                          className={`nav-link${tab === 'reviews' ? ' active' : ''}`}
                          onClick={() => setTab('reviews')}
                        >
                          Reviews ({product.reviewCount})
                        </button>
                      </li>
                    </ul>
                  </div>

                  {tab === 'description' && (
                    <div className="product-tab-item-box tab-pane fade show active">
                      <div className="product-tab-item-content">
                        {product.description ? (
                          <p style={{ whiteSpace: 'pre-wrap' }}>{product.description}</p>
                        ) : (
                          <p>No detailed description yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {tab === 'specs' && (
                    <div className="product-tab-item-box tab-pane fade show active">
                      <ProductAdditionalInfo
                        product={product}
                        specs={specs}
                        onOpenReviews={() => setTab('reviews')}
                      />
                    </div>
                  )}

                  {tab === 'reviews' && (
                    <div className="product-tab-item-box tab-pane fade show active">
                      <ProductReviewsPanel
                        productId={product.productId}
                        active={tab === 'reviews'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <SimilarProductsSection
        productId={product.productId}
        categoryId={product.category.categoryId}
        limit={8}
      />
    </>
  );
}
