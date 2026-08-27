import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProductDetail } from '../../types/catalog';
import { formatMoney } from '../../utils/formatCatalog';

type SpecEntry = [string, string];

type Props = {
  product: ProductDetail;
  specs: Record<string, string>;
  onOpenReviews: () => void;
};

function InfoRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: ReactNode;
  emphasize?: boolean;
}) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div className={`catalog-info-row${emphasize ? ' is-emphasize' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function InfoSection({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`catalog-info-section${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="catalog-info-section__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="catalog-info-section__chevron" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div id={id} className="catalog-info-section__body">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function humanizeSpecKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProductAdditionalInfo({ product, specs, onOpenReviews }: Props) {
  const discount =
    product.salePrice != null && product.basePrice > product.salePrice
      ? Math.round(((product.basePrice - product.salePrice) / product.basePrice) * 100)
      : 0;

  const inStock = product.availableQuantity > 0;
  const specEntries = Object.entries(specs) as SpecEntry[];
  const shopPath = `/shops/${encodeURIComponent(product.shop.slug || product.shop.shopId)}`;

  return (
    <div className="product-additional-content catalog-buyer-info">
      <div className="product-additional-content-title">
        <h2>Additional Information</h2>
        <p className="catalog-buyer-info__lead">Key details buyers usually check before purchasing.</p>
      </div>

      <div className="catalog-info-highlights" aria-label="Key product highlights">
        <div className="catalog-info-highlight">
          <span className="catalog-info-highlight__label">Price</span>
          <span className="catalog-info-highlight__value">
            {formatMoney(product.effectivePrice, product.currency)}
            {discount > 0 ? (
              <span className="catalog-info-badge catalog-info-badge--sale">{discount}% off</span>
            ) : null}
          </span>
          {product.salePrice != null && product.salePrice < product.basePrice ? (
            <span className="catalog-info-highlight__sub catalog-info-highlight__sub--strike">
              {formatMoney(product.basePrice, product.currency)}
            </span>
          ) : null}
        </div>

        <div className="catalog-info-highlight">
          <span className="catalog-info-highlight__label">Availability</span>
          <span className="catalog-info-highlight__value">
            <span
              className={`catalog-info-badge ${inStock ? 'catalog-info-badge--ok' : 'catalog-info-badge--warn'}`}
            >
              {inStock ? 'In stock' : 'Out of stock'}
            </span>
          </span>
          <span className="catalog-info-highlight__sub">
            {inStock
              ? `${product.availableQuantity} available`
              : 'Check back later or chat with the seller'}
          </span>
        </div>

        <div className="catalog-info-highlight">
          <span className="catalog-info-highlight__label">Rating</span>
          <span className="catalog-info-highlight__value">
            ★ {product.avgRating > 0 ? product.avgRating.toFixed(1) : '—'}
          </span>
          <button type="button" className="catalog-info-highlight__link" onClick={onOpenReviews}>
            {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}
          </button>
        </div>

        <div className="catalog-info-highlight">
          <span className="catalog-info-highlight__label">Seller</span>
          <span className="catalog-info-highlight__value">
            <Link to={shopPath}>{product.shop.shopName}</Link>
            {product.shop.isVerified ? (
              <span className="catalog-info-badge catalog-info-badge--verified">Verified</span>
            ) : null}
          </span>
          <span className="catalog-info-highlight__sub">
            Shop ★ {product.shop.avgRating.toFixed(1)} ({product.shop.ratingCount})
          </span>
        </div>
      </div>

      <div className="catalog-info-sections">
        <InfoSection id="info-product" title="Product details" defaultOpen>
          <dl className="catalog-info-list">
            <InfoRow label="Brand" value={product.brand} emphasize />
            <InfoRow label="Model" value={product.modelNumber} />
            <InfoRow
              label="Category"
              value={
                <Link to={`/products?categoryId=${product.category.categoryId}`}>
                  {product.category.name}
                </Link>
              }
            />
            <InfoRow label="Condition" value={product.conditionType} />
            <InfoRow label="Origin" value={product.originCountry} />
            <InfoRow
              label="Warranty"
              value={
                product.warrantyMonths != null ? `${product.warrantyMonths} months` : null
              }
              emphasize={product.warrantyMonths != null}
            />
          </dl>
        </InfoSection>

        <InfoSection id="info-pricing" title="Pricing & availability" defaultOpen>
          <dl className="catalog-info-list">
            <InfoRow
              label="Current price"
              value={formatMoney(product.effectivePrice, product.currency)}
              emphasize
            />
            {product.salePrice != null && product.salePrice < product.basePrice ? (
              <InfoRow
                label="List price"
                value={
                  <span className="catalog-info-strike">
                    {formatMoney(product.basePrice, product.currency)}
                  </span>
                }
              />
            ) : null}
            <InfoRow
              label="Stock"
              value={
                inStock ? (
                  <span>
                    <strong>{product.availableQuantity}</strong> available
                    {product.soldCount > 0 ? ` · ${product.soldCount} sold` : ''}
                  </span>
                ) : (
                  'Out of stock'
                )
              }
              emphasize
            />
          </dl>
        </InfoSection>

        <InfoSection id="info-seller" title="Seller" defaultOpen>
          <dl className="catalog-info-list">
            <InfoRow
              label="Shop"
              value={
                <span className="catalog-info-seller-name">
                  <Link to={shopPath}>{product.shop.shopName}</Link>
                  {product.shop.isVerified ? (
                    <span className="catalog-info-badge catalog-info-badge--verified">
                      Verified seller
                    </span>
                  ) : null}
                </span>
              }
              emphasize
            />
            <InfoRow
              label="Shop rating"
              value={`★ ${product.shop.avgRating.toFixed(1)} · ${product.shop.ratingCount} ratings`}
            />
          </dl>
        </InfoSection>

        <InfoSection id="info-rating" title="Rating & reviews" defaultOpen>
          <dl className="catalog-info-list">
            <InfoRow
              label="Average rating"
              value={
                product.avgRating > 0 ? (
                  <strong>★ {product.avgRating.toFixed(1)} / 5</strong>
                ) : (
                  'No ratings yet'
                )
              }
              emphasize
            />
            <InfoRow
              label="Customer reviews"
              value={
                <button type="button" className="catalog-info-text-btn" onClick={onOpenReviews}>
                  View {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}
                </button>
              }
            />
          </dl>
        </InfoSection>

        {specEntries.length > 0 ? (
          <InfoSection
            id="info-specs"
            title="Technical specifications"
            defaultOpen={specEntries.length <= 6}
          >
            <dl className="catalog-info-list">
              {specEntries.map(([key, value]) => (
                <InfoRow key={key} label={humanizeSpecKey(key)} value={value} />
              ))}
            </dl>
          </InfoSection>
        ) : null}
      </div>
    </div>
  );
}
