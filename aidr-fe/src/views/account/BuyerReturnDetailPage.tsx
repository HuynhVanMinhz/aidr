import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToastMessage } from '../../hooks/useToastMessage';
import { getBuyerReturnById, requireBuyerReturn } from '../../services/returnApi';
import type { BuyerReturnEvidence, BuyerReturnRequest } from '../../types/return';
import { getApiErrorMessage } from '../../utils/apiError';
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from '../../utils/catalogImage';
import { formatMoney } from '../../utils/formatCatalog';
import { formatOrderDate } from '../../utils/orderUi';
import {
  buyerReturnStatusClass,
  formatResolutionType,
  formatReturnStatus,
  returnHistoryActor,
  returnStatusHint,
  returnStatusIcon,
  returnTimelineStages,
} from '../../utils/returnUi';

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

function isVideo(url: string) {
  return VIDEO_EXT.test(url);
}

function evidenceLabel(evidence: BuyerReturnEvidence) {
  switch (evidence.evidenceType) {
    case 'Unboxing':
      return 'Unboxing';
    case 'Testing':
      return 'Testing';
    default:
      return evidence.evidenceType || 'Evidence';
  }
}

export function BuyerReturnDetailPage() {
  const { returnId } = useParams<{ returnId: string }>();
  const [item, setItem] = useState<BuyerReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useToastMessage(error);

  useEffect(() => {
    if (!returnId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getBuyerReturnById(returnId)
      .then((result) => {
        if (cancelled) return;
        setItem(requireBuyerReturn(result));
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [returnId]);

  if (!returnId) {
    return (
      <div className="account-details-content-box">
        <div className="page-state">
          <p className="page-state__title">Return request not found</p>
          <p className="page-state__text">The link is missing a return request id.</p>
          <Link to="/account/returns" className="btn-default">
            Back to returns
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="account-details-content-box">
        <p className="account-muted">Loading return request…</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="account-details-content-box">
        <div className="page-state">
          <p className="page-state__title">Return request not available</p>
          <p className="page-state__text">
            This return request could not be loaded. It may have been removed.
          </p>
          <Link to="/account/returns" className="btn-default">
            Back to returns
          </Link>
        </div>
      </div>
    );
  }

  const refundTotal =
    item.refundAmount ?? item.items.reduce((sum, line) => sum + line.lineTotal, 0);
  const isRefunded = item.status === 'Refunded' || item.status === 'Closed';
  const isRejected = item.status === 'Rejected';
  const hint = returnStatusHint(item.status);

  // Completed stages come from the history, so a rejected return never shows
  // later stages as done.
  const reachedStages = new Set(item.statusHistories.map((h) => h.toStatus));
  reachedStages.add(item.status);

  return (
    <div className="return-detail">
      <header className="return-detail__head">
        <div className="return-detail__heading">
          <p className="return-detail__eyebrow">Return request</p>
          <h2 className="return-detail__code">{item.orderCode}</h2>
          <p className="return-detail__submitted">
            Submitted {formatOrderDate(item.createdAt)}
          </p>
        </div>
        <span className={`${buyerReturnStatusClass(item.status)} return-status-chip`}>
          <i className={returnStatusIcon(item.status)} aria-hidden />
          {formatReturnStatus(item.status)}
        </span>
      </header>

      {hint ? (
        <p className={`return-detail__hint${isRejected ? ' return-detail__hint--warn' : ''}`}>
          <i className="fa-solid fa-circle-info" aria-hidden />
          <span>{hint}</span>
        </p>
      ) : null}

      <div className="return-detail__grid">
        <div className="return-detail__main">
          <section className="return-card">
            <h3 className="return-card__title">Return information</h3>
            <dl className="return-facts">
              <dt>Reason</dt>
              <dd>{item.reason}</dd>
              {item.description ? (
                <>
                  <dt>Description</dt>
                  <dd>{item.description}</dd>
                </>
              ) : null}
              <dt>Resolution</dt>
              <dd>{formatResolutionType(item.resolutionType)}</dd>
            </dl>
            {item.adminNote ? (
              <p className="return-admin-note">
                <strong>Note from support:</strong> {item.adminNote}
              </p>
            ) : null}
          </section>

          <section className="return-card">
            <h3 className="return-card__title">Returned items</h3>
            <ul className="return-item-list">
              {item.items.map((line, index) => (
                <li key={line.returnItemId} className="return-item">
                  <Link to={`/products/${line.productId}`} className="return-item__thumb">
                    <img
                      src={resolveProductImageUrl(line.imageUrl, index)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallback === '1') return;
                        img.dataset.fallback = '1';
                        img.src = PRODUCT_IMAGE_PLACEHOLDER;
                      }}
                    />
                  </Link>
                  <div className="return-item__info">
                    <Link to={`/products/${line.productId}`} className="return-item__name">
                      {line.productName}
                    </Link>
                    <p className="return-item__meta">
                      {line.sku ? <span>{line.sku}</span> : null}
                      <span>Qty {line.quantity}</span>
                      <span>{formatMoney(line.unitPrice, 'VND')} each</span>
                    </p>
                  </div>
                  <p className="return-item__total">{formatMoney(line.lineTotal, 'VND')}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="return-card">
            <h3 className="return-card__title">Evidence</h3>
            {item.evidences.length === 0 ? (
              <p className="return-empty">
                No photos or videos were attached to this request.
              </p>
            ) : (
              <ul className="return-evidence-grid">
                {item.evidences.map((evidence) => (
                  <li key={evidence.evidenceId}>
                    <a
                      href={evidence.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="return-evidence"
                    >
                      <span className="return-evidence__media">
                        {isVideo(evidence.mediaUrl) ? (
                          <>
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <video src={evidence.mediaUrl} preload="metadata" muted />
                            <span className="return-evidence__play" aria-hidden>
                              <i className="fa-solid fa-play" />
                            </span>
                          </>
                        ) : (
                          <img
                            src={evidence.mediaUrl}
                            alt={`${evidenceLabel(evidence)} evidence`}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.closest('.return-evidence')?.classList.add(
                                'return-evidence--broken',
                              );
                            }}
                          />
                        )}
                      </span>
                      <span className="return-evidence__label">{evidenceLabel(evidence)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="return-detail__side">
          <section className="return-card return-refund">
            <h3 className="return-card__title">Refund</h3>
            <p className="return-refund__amount">{formatMoney(refundTotal, 'VND')}</p>
            <p className="return-refund__state">
              {isRefunded
                ? 'Sent to your bank'
                : isRejected
                  ? 'Not refunded — request declined'
                  : 'Estimated, pending approval'}
            </p>
            <div className="return-refund__actions">
              <Link
                to={`/account/orders/${item.orderId}`}
                className="return-btn return-btn--secondary"
              >
                <i className="fa-solid fa-receipt" aria-hidden />
                View original order
              </Link>
              <Link to="/chat" className="return-btn return-btn--ghost">
                <i className="fa-regular fa-comments" aria-hidden />
                Contact support
              </Link>
            </div>
          </section>

          <section className="return-card">
            <h3 className="return-card__title">Progress</h3>
            <ol className="return-timeline">
              {item.statusHistories.map((entry, index) => (
                <li
                  key={`${entry.createdAt}-${index}`}
                  className={`return-timeline__step${
                    index === item.statusHistories.length - 1
                      ? ' return-timeline__step--current'
                      : ''
                  }`}
                >
                  <span className="return-timeline__marker" aria-hidden>
                    <i className={returnStatusIcon(entry.toStatus)} />
                  </span>
                  <div className="return-timeline__body">
                    <p className="return-timeline__title">
                      {formatReturnStatus(entry.toStatus)}
                      <span className="return-timeline__actor">
                        {returnHistoryActor(entry.fromStatus)}
                      </span>
                    </p>
                    <p className="return-timeline__time">{formatOrderDate(entry.createdAt)}</p>
                    {entry.note ? <p className="return-timeline__note">{entry.note}</p> : null}
                  </div>
                </li>
              ))}

              {/* Stages still ahead, so the buyer sees where this is going. */}
              {!isRejected
                ? returnTimelineStages(item.resolutionType)
                    .filter((stage) => !reachedStages.has(stage))
                    .map((stage) => (
                      <li
                        key={stage}
                        className="return-timeline__step return-timeline__step--upcoming"
                      >
                        <span className="return-timeline__marker" aria-hidden>
                          <i className={returnStatusIcon(stage)} />
                        </span>
                        <div className="return-timeline__body">
                          <p className="return-timeline__title">{formatReturnStatus(stage)}</p>
                          <p className="return-timeline__time">Not yet</p>
                        </div>
                      </li>
                    ))
                : null}
            </ol>
          </section>
        </aside>
      </div>

      <p className="return-detail__foot">
        <Link to="/account/returns" className="return-back-link">
          <i className="fa-solid fa-arrow-left" aria-hidden /> Back to returns
        </Link>
      </p>
    </div>
  );
}
