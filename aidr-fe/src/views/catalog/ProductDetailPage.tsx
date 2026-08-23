import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { useProductDetail } from '../../hooks/useCatalog';
import {
  discountPercent,
  formatDateVi,
  formatMoney,
  parseSpecsJson,
  parseTagsJson,
} from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';

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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <tr>
      <td>
        <b>{label}</b>
      </td>
      <td>{value}</td>
    </tr>
  );
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { product, loading, error } = useProductDetail(id);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState<'description' | 'specs' | 'reviews'>('description');
  const [qty, setQty] = useState(1);

  const images = useMemo(() => {
    if (!product) return [];
    if (product.images.length > 0) return product.images;
    return [{ productImageId: 'placeholder', imageUrl: PLACEHOLDER, sortOrder: 0, isPrimary: true }];
  }, [product]);

  const specs = useMemo(() => parseSpecsJson(product?.specsJson), [product?.specsJson]);
  const tags = useMemo(() => parseTagsJson(product?.tagsJson), [product?.tagsJson]);

  if (loading) {
    return (
      <div className="page-product-single">
        <div className="container">
          <p>Đang tải sản phẩm…</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-product-single">
        <div className="container">
          <div className="alert alert-danger" role="alert">
            {error || 'Không tìm thấy sản phẩm.'}
          </div>
          <Link to="/products" className="btn-default btn-accent">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const mainImage = images[Math.min(activeImage, images.length - 1)]?.imageUrl ?? PLACEHOLDER;
  const off = discountPercent(product.basePrice, product.salePrice);
  const maxQty = Math.max(1, product.availableQuantity);
  const safeQty = Math.min(Math.max(1, qty), maxQty);

  return (
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
                      {formatMoney(product.effectivePrice, product.currency)}{' '}
                      {product.salePrice != null && product.salePrice < product.basePrice && (
                        <span>{formatMoney(product.basePrice, product.currency)}</span>
                      )}
                    </h2>
                  </div>

                  <div className="product-single-content-body">
                    <div className="qty-box">
                      <button
                        type="button"
                        className="qty-btn minus"
                        aria-label="Giảm số lượng"
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
                        aria-label="Số lượng"
                      />
                      <button
                        type="button"
                        className="qty-btn plus"
                        aria-label="Tăng số lượng"
                        disabled={safeQty >= maxQty}
                        onClick={() => setQty((v) => Math.min(maxQty, v + 1))}
                      >
                        +
                      </button>
                    </div>
                    <div className="product-single-content-btn">
                      <Link to="/login" className="btn-default btn-accent">
                        Add To cart
                      </Link>
                    </div>
                    <div className="product-single-action">
                      <ul>
                        <li>
                          <Link to="/login" aria-label="Wishlist">
                            <img src="/theme/images/icon-wishlist-primary.svg" alt="" />
                          </Link>
                        </li>
                        <li>
                          <a href="#compare" onClick={(e) => e.preventDefault()} aria-label="Compare">
                            <img src="/theme/images/icon-compare-primary.svg" alt="" />
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="product-single-content-footer">
                    <div className="product-single-details-list">
                      <ul>
                        {product.modelNumber && (
                          <li>
                            <span>SKU / Model:</span> {product.modelNumber}
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
                          {product.availableQuantity > 0
                            ? `${product.availableQuantity} available (${product.stockQuantity} total)`
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
                          <span>Shop:</span> {product.shop.shopName}
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
                      <Link to={`/products?q=${encodeURIComponent(product.shop.shopName)}`}>
                        Xem thêm sản phẩm từ shop
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
                          <p>Chưa có mô tả chi tiết.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {tab === 'specs' && (
                    <div className="product-tab-item-box tab-pane fade show active">
                      <div className="product-additional-content">
                        <div className="product-additional-content-title">
                          <h2>Additional Information</h2>
                        </div>
                        <div className="product-additional-info-table">
                          <table>
                            <tbody>
                              <DetailRow label="Product name" value={product.name} />
                              <DetailRow label="Slug" value={product.slug} />
                              <DetailRow label="Brand" value={product.brand} />
                              <DetailRow label="Model number" value={product.modelNumber} />
                              <DetailRow label="Category" value={product.category.name} />
                              <DetailRow label="Condition" value={product.conditionType} />
                              <DetailRow label="Origin country" value={product.originCountry} />
                              <DetailRow
                                label="Warranty"
                                value={
                                  product.warrantyMonths != null
                                    ? `${product.warrantyMonths} months`
                                    : null
                                }
                              />
                              <DetailRow label="Currency" value={product.currency} />
                              <DetailRow
                                label="Base price"
                                value={formatMoney(product.basePrice, product.currency)}
                              />
                              <DetailRow
                                label="Sale price"
                                value={
                                  product.salePrice != null
                                    ? formatMoney(product.salePrice, product.currency)
                                    : null
                                }
                              />
                              <DetailRow
                                label="Stock quantity"
                                value={String(product.stockQuantity)}
                              />
                              <DetailRow
                                label="Available quantity"
                                value={String(product.availableQuantity)}
                              />
                              <DetailRow label="Sold count" value={String(product.soldCount)} />
                              <DetailRow label="View count" value={String(product.viewCount)} />
                              <DetailRow label="Average rating" value={product.avgRating.toFixed(1)} />
                              <DetailRow label="Review count" value={String(product.reviewCount)} />
                              <DetailRow
                                label="Featured"
                                value={product.isFeatured ? 'Yes' : 'No'}
                              />
                              <DetailRow label="Published at" value={formatDateVi(product.publishedAt)} />
                              <DetailRow label="Shop" value={product.shop.shopName} />
                              <DetailRow
                                label="Shop verified"
                                value={product.shop.isVerified ? 'Yes' : 'No'}
                              />
                              <DetailRow label="Tags" value={tags.length > 0 ? tags.join(', ') : null} />
                              {Object.entries(specs).map(([key, value]) => (
                                <DetailRow key={key} label={key} value={value} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === 'reviews' && (
                    <div className="product-tab-item-box tab-pane fade show active">
                      <div className="product-review-form-content">
                        <div className="catalog-detail-review-summary">
                          <StarRow rating={product.avgRating} showValue />
                          <p>
                            {product.reviewCount} đánh giá · {product.soldCount} đã bán
                          </p>
                        </div>
                        <div className="customer-review-list">
                          {product.recentReviews.length === 0 ? (
                            <p>Chưa có đánh giá.</p>
                          ) : (
                            product.recentReviews.map((review) => (
                              <div key={review.reviewId} className="customer-review-item">
                                <div className="icon-box catalog-review-avatar">
                                  <span>{review.buyerName.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="customer-review-item-body">
                                  <div className="customer-review-item-content">
                                    <p>
                                      <span>{review.buyerName}</span> —{' '}
                                      {formatDateVi(review.createdAt)}
                                    </p>
                                    {review.title && <p><strong>{review.title}</strong></p>}
                                    {review.content && <p>{review.content}</p>}
                                  </div>
                                  <StarRow rating={review.rating} />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
