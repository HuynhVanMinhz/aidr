import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { checkCompatibility, requireCompatibilityResult } from '../../services/compatibilityApi';
import { getProductBundle, requireProductBundle } from '../../services/bundleApi';
import type { BundleItem, CompatibilityResult } from '../../types/v2Features';
import type { ProductListItem } from '../../types/catalog';
import { useToast } from '../../hooks/useToast';

type Props = {
  productId: string;
  productName: string;
};

function bundleItemToListItem(item: BundleItem): ProductListItem {
  return {
    productId: item.productId,
    name: item.name,
    slug: item.slug,
    shortDescription: item.shortDescription,
    brand: item.brand,
    basePrice: item.basePrice,
    salePrice: item.salePrice,
    effectivePrice: item.effectivePrice,
    maxEffectivePrice: item.effectivePrice,
    variantCount: 0,
    currency: item.currency,
    stockQuantity: item.availableQuantity,
    availableQuantity: item.availableQuantity,
    avgRating: item.avgRating,
    reviewCount: item.reviewCount,
    soldCount: 0,
    isFeatured: false,
    primaryImageUrl: item.primaryImageUrl,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    shopId: item.shopId,
    shopName: item.shopName,
  };
}

function verdictTone(verdict: string): 'compatible' | 'incompatible' | 'unknown' {
  const normalized = verdict.toLowerCase();
  if (normalized.includes('compatible') && !normalized.includes('incompatible')) {
    return 'compatible';
  }
  if (normalized.includes('incompatible') || normalized.includes('not')) {
    return 'incompatible';
  }
  return 'unknown';
}

function formatSourceLabel(source: string | null): string | null {
  if (!source) return null;
  const key = source.trim().toLowerCase();
  if (key === 'rule') return 'Matched accessories';
  if (key === 'groq') return 'AI suggestions';
  if (key === 'similar' || key === 'recommendation') return 'Similar picks';
  return null;
}

export function ProductBundleSection({ productId, productName }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<BundleItem[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [compatResult, setCompatResult] = useState<CompatibilityResult | null>(null);
  const [compatItemId, setCompatItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCompatResult(null);
    setCompatItemId(null);

    getProductBundle(productId)
      .then((result) => {
        if (cancelled) return;
        const bundle = requireProductBundle(result);
        setItems(bundle.items);
        setSource(bundle.source);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setSource(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleCheckCompatibility(item: BundleItem) {
    setCheckingId(item.productId);
    setCompatItemId(item.productId);
    setCompatResult(null);
    try {
      const result = await checkCompatibility({
        primaryProductId: productId,
        secondaryProductId: item.productId,
      });
      setCompatResult(requireCompatibilityResult(result));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to check compatibility.');
      setCompatItemId(null);
    } finally {
      setCheckingId(null);
    }
  }

  if (!loading && items.length === 0) {
    return null;
  }

  const sourceLabel = formatSourceLabel(source);
  const activeCompatItem = items.find((item) => item.productId === compatItemId) ?? null;
  const tone = compatResult ? verdictTone(compatResult.verdict) : 'unknown';

  return (
    <div className="related-products catalog-bundle-section">
      <div className="container">
        <div className="row section-row align-items-center">
          <div className="col-xl-9">
            <div className="section-title">
              <span className="section-sub-title">Complete your setup</span>
              <h2 className="text-anime-style-3">Frequently bought together</h2>
              <p className="catalog-bundle-section__source">
                Suggestions for {productName}
                {sourceLabel ? ` · ${sourceLabel}` : ''}
              </p>
            </div>
          </div>
        </div>

        {loading ? <p>Loading bundle suggestions…</p> : null}

        {!loading && items.length > 0 ? (
          <>
            <div className="row">
              <div className="col-lg-12">
                <div className="related-product-items-list catalog-bundle-items-list">
                  {items.map((item) => (
                    <div key={item.productId} className="catalog-bundle-item">
                      <ProductCard product={bundleItemToListItem(item)} variant="list" />
                      {item.reason ? (
                        <p className="catalog-bundle-item__reason">{item.reason}</p>
                      ) : null}
                      <button
                        type="button"
                        className="btn-default btn-border catalog-bundle-item__compat-btn"
                        disabled={checkingId === item.productId}
                        onClick={() => void handleCheckCompatibility(item)}
                      >
                        {checkingId === item.productId ? 'Checking…' : 'Check compatibility'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {compatResult && activeCompatItem ? (
              <div className={`catalog-compat-result is-${tone}`} role="status">
                <div className="catalog-compat-result__top">
                  <span className={`catalog-compat-result__badge is-${tone}`}>
                    {compatResult.verdict}
                  </span>
                  <p className="catalog-compat-result__pair">
                    {productName} + {activeCompatItem.name}
                  </p>
                </div>
                <h3 className="catalog-compat-result__headline">{compatResult.headline}</h3>
                {compatResult.reasons.length > 0 ? (
                  <ul className="catalog-compat-result__reasons">
                    {compatResult.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                {compatResult.matchedSpecs.length > 0 ? (
                  <dl className="catalog-compat-result__specs">
                    {compatResult.matchedSpecs.map((spec) => (
                      <div key={spec.label} className="catalog-compat-result__spec-row">
                        <dt>{spec.label}</dt>
                        <dd>
                          {spec.primary ?? '—'} / {spec.secondary ?? '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <div className="catalog-compat-result__actions">
                  <Link
                    to={`/products/${activeCompatItem.productId}`}
                    className="btn-default btn-border"
                  >
                    View accessory
                  </Link>
                  <button
                    type="button"
                    className="btn-default btn-border"
                    onClick={() => {
                      setCompatResult(null);
                      setCompatItemId(null);
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
