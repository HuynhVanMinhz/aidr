import { useEffect, useState } from 'react';
import type { ReviewDigest } from '../../types/v2Features';
import { getProductReviewDigest, requireReviewDigest } from '../../services/reviewDigestApi';
import { formatDateVi } from '../../utils/formatCatalog';

type Props = {
  productId: string;
  active?: boolean;
};

export function ReviewDigestSection({ productId, active = true }: Props) {
  const [digest, setDigest] = useState<ReviewDigest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);

    getProductReviewDigest(productId)
      .then((result) => {
        if (cancelled) return;
        setDigest(requireReviewDigest(result));
      })
      .catch(() => {
        if (!cancelled) setDigest(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, active]);

  if (loading) {
    return (
      <div className="catalog-review-digest">
        <p className="catalog-muted">Loading review summary…</p>
      </div>
    );
  }

  if (!digest?.available) {
    return null;
  }

  const sentiment = digest.sentiment;
  const sentimentTotal = sentiment
    ? sentiment.positive + sentiment.neutral + sentiment.negative
    : 0;

  return (
    <section className="catalog-review-digest" aria-label="Review summary">
      <div className="catalog-review-digest__head">
        <h3 className="catalog-review-digest__title">What buyers are saying</h3>
        {digest.generatedAt ? (
          <p className="catalog-review-digest__meta">
            Based on {digest.reviewCount} review{digest.reviewCount === 1 ? '' : 's'}
            {digest.source ? ` · ${digest.source}` : ''}
            {' · '}
            Updated {formatDateVi(digest.generatedAt)}
          </p>
        ) : null}
      </div>

      {digest.summaryLine ? (
        <p className="catalog-review-digest__summary">{digest.summaryLine}</p>
      ) : null}

      <div className="catalog-review-digest__columns">
        {digest.pros.length > 0 ? (
          <div className="catalog-review-digest__list catalog-review-digest__list--pros">
            <h4>Pros</h4>
            <ul>
              {digest.pros.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {digest.cons.length > 0 ? (
          <div className="catalog-review-digest__list catalog-review-digest__list--cons">
            <h4>Cons</h4>
            <ul>
              {digest.cons.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {sentiment && sentimentTotal > 0 ? (
        <div className="catalog-review-digest__sentiment" aria-label="Sentiment breakdown">
          <span className="catalog-review-digest__sentiment-item is-positive">
            Positive {Math.round((sentiment.positive / sentimentTotal) * 100)}%
          </span>
          <span className="catalog-review-digest__sentiment-item is-neutral">
            Neutral {Math.round((sentiment.neutral / sentimentTotal) * 100)}%
          </span>
          <span className="catalog-review-digest__sentiment-item is-negative">
            Negative {Math.round((sentiment.negative / sentimentTotal) * 100)}%
          </span>
        </div>
      ) : null}
    </section>
  );
}
