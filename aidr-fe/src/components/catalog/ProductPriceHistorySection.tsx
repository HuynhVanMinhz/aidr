import { useEffect, useMemo, useState } from 'react';
import type { ProductPriceHistory } from '../../types/v2Features';
import { getProductPriceHistory, requireProductPriceHistory } from '../../services/productPriceHistoryApi';
import { formatMoney } from '../../utils/formatCatalog';

type Props = {
  productId: string;
  currency?: string;
};

function buildPath(points: ProductPriceHistory['points'], width: number, height: number, min: number, max: number) {
  if (points.length === 0) return '';
  const range = max - min || 1;
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - ((point.price - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function ProductPriceHistorySection({ productId, currency = 'VND' }: Props) {
  const [history, setHistory] = useState<ProductPriceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getProductPriceHistory(productId, 90)
      .then((result) => {
        if (cancelled) return;
        setHistory(requireProductPriceHistory(result));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load price history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const chart = useMemo(() => {
    if (!history || history.points.length < 2) return null;
    const prices = history.points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const width = 320;
    const height = 80;
    return {
      path: buildPath(history.points, width, height, min, max),
      width,
      height,
      min,
      max,
    };
  }, [history]);

  if (loading) {
    return (
      <div className="catalog-price-history">
        <p className="catalog-muted">Loading price history…</p>
      </div>
    );
  }

  if (error || !history) {
    return null;
  }

  return (
    <div className="catalog-price-history">
      <h3 className="catalog-price-history__title">Price history (90 days)</h3>
      {chart ? (
        <svg
          className="catalog-price-history__chart"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label="Product price history chart"
        >
          <path
            d={chart.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <p className="catalog-muted">Not enough price changes yet.</p>
      )}
      <div className="catalog-price-history__stats">
        <span>Current: {formatMoney(history.currentPrice, currency)}</span>
        {history.lowestInPeriod != null && (
          <span>Low: {formatMoney(history.lowestInPeriod, currency)}</span>
        )}
        {history.highestInPeriod != null && (
          <span>High: {formatMoney(history.highestInPeriod, currency)}</span>
        )}
      </div>
    </div>
  );
}
