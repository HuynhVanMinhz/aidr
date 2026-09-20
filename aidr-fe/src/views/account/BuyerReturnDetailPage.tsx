import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReturnEvidenceGallery } from '../../components/returns/ReturnEvidenceMedia';
import { useToastMessage } from '../../hooks/useToastMessage';
import { addNotificationHandler, removeNotificationHandler } from '../../realtime/signalr';
import { getBuyerReturnById, requireBuyerReturn } from '../../services/returnApi';
import type { NotificationItem } from '../../types/notification';
import type { BuyerReturnRequest } from '../../types/return';
import { getApiErrorMessage } from '../../utils/apiError';
import { PRODUCT_IMAGE_PLACEHOLDER, resolveProductImageUrl } from '../../utils/catalogImage';
import { formatMoney } from '../../utils/formatCatalog';
import { formatOrderDate } from '../../utils/orderUi';
import {
  buyerReturnStatusClass,
  formatResolutionType,
  formatReturnStatus,
  formatTimelineNote,
  isLogisticsStatus,
  isTerminalReturnStatus,
  returnHistoryActor,
  returnStatusHint,
  returnStatusIcon,
  returnTimelineActiveStage,
  returnTimelineStages,
} from '../../utils/returnUi';

// Fallback poll interval — SignalR is the primary trigger, this catches reconnect gaps.
const FALLBACK_POLL_MS = 60_000;

export function BuyerReturnDetailPage() {
  const { returnId } = useParams<{ returnId: string }>();
  const [item, setItem] = useState<BuyerReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useToastMessage(error);

  const fetchData = useCallback(
    async (silent = false) => {
      if (!returnId) return;
      try {
        const result = await getBuyerReturnById(returnId);
        const data = requireBuyerReturn(result);
        setItem(data);
        if (silent) setLastRefreshed(new Date());
      } catch (err) {
        if (!silent) setError(getApiErrorMessage(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [returnId],
  );

  // Initial load
  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchData(false);
  }, [fetchData]);

  // Real-time: listen to the shared notification hub.
  // When a ReturnRequest notification for THIS return arrives, refetch silently.
  useEffect(() => {
    if (!returnId) return;
    if (item && isTerminalReturnStatus(item.status)) return;

    const handler = (notification: NotificationItem) => {
      if (
        notification.referenceType === 'ReturnRequest' &&
        notification.referenceId?.toLowerCase() === returnId.toLowerCase()
      ) {
        void fetchData(true);
      }
    };

    addNotificationHandler(handler);
    return () => removeNotificationHandler(handler);
  }, [returnId, fetchData, item?.status]);

  // Fallback poll (60 s) — catches SignalR reconnect gaps / network hiccups.
  useEffect(() => {
    if (!item) return;
    if (isTerminalReturnStatus(item.status)) return;

    const id = setInterval(() => {
      void fetchData(true);
    }, FALLBACK_POLL_MS);

    return () => clearInterval(id);
  }, [fetchData, item?.status]);

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
  const isPickupFailed = item.status === 'PickupFailed';
  const hint = returnStatusHint(item.status);

  // Find tracking code from status history notes (format "Return shipment created: XXXXX")
  const trackingCode = (() => {
    for (const h of [...item.statusHistories].reverse()) {
      if (h.toStatus === 'AwaitingPickup' && h.note?.startsWith('Return shipment created:')) {
        return h.note.split(':').slice(1).join(':').trim();
      }
    }
    return null;
  })();

  // For timeline display, collapse PickedUp/InTransit/PickupFailed → AwaitingPickup
  const activeTimelineStage = returnTimelineActiveStage(item.status);

  // Stages reached by history (so rejected returns never show later stages as done).
  const reachedStages = new Set(
    item.statusHistories.map((h) => returnTimelineActiveStage(h.toStatus)),
  );
  reachedStages.add(activeTimelineStage);

  // Upcoming = not yet reached AND still ahead of current stage in timeline order.
  // Without the index guard, skipped stages (e.g. AwaitingPickup when seller marks
  // receiving manually) would incorrectly appear as "Not yet" after Accepted/Closed.
  const timelineStages = returnTimelineStages(item.resolutionType);
  const activeStageIndex = timelineStages.indexOf(activeTimelineStage);
  const upcomingStages = isRejected
    ? []
    : timelineStages.filter(
        (stage) =>
          !reachedStages.has(stage) && timelineStages.indexOf(stage) > activeStageIndex,
      );

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
            <ReturnEvidenceGallery evidences={item.evidences} />
          </section>
        </div>

        <aside className="return-detail__side">
          {(isLogisticsStatus(item.status) || trackingCode) && (
            <section
              className={`return-card return-tracking${isPickupFailed ? ' return-tracking--failed' : ''}`}
            >
              <h3 className="return-card__title">
                <i className="fa-solid fa-truck-moving" aria-hidden /> Return pickup
              </h3>
              {isPickupFailed ? (
                <p className="return-tracking__status return-tracking__status--failed">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden /> Pickup failed —
                  our support team will contact you
                </p>
              ) : (
                <p className="return-tracking__status">
                  <i className={returnStatusIcon(item.status)} aria-hidden />{' '}
                  {formatReturnStatus(item.status)}
                </p>
              )}
              {trackingCode && (
                <p className="return-tracking__code">
                  Tracking code: <strong>{trackingCode}</strong>
                </p>
              )}
              <p className="return-tracking__note">
                The shipper will pick up from your original delivery address.
              </p>
            </section>
          )}

          <section className="return-card return-refund">
            <h3 className="return-card__title">Refund</h3>
            <p className="return-refund__amount">{formatMoney(refundTotal, 'VND')}</p>
            <p className="return-refund__state">
              {isRefunded
                ? 'Sent to your bank'
                : isRejected
                  ? 'Not refunded - request declined'
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
            <h3 className="return-card__title">
              Progress
              {!isTerminalReturnStatus(item.status) && (
                <span className="return-live-badge" title="Updates automatically every 30 s">
                  <span className="return-live-badge__dot" aria-hidden />
                  Live
                </span>
              )}
            </h3>
            {lastRefreshed && (
              <p className="return-live-updated">
                Updated {formatOrderDate(lastRefreshed.toISOString())}
              </p>
            )}
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
                    {formatTimelineNote(entry.toStatus, entry.note) ? (
                      <p className="return-timeline__note">
                        {formatTimelineNote(entry.toStatus, entry.note)}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}

              {/* Stages still ahead (index-guarded so skipped stages don't reappear) */}
              {upcomingStages.map((stage) => (
                <li
                  key={stage}
                  className="return-timeline__step return-timeline__step--upcoming"
                >
                  <span className="return-timeline__marker" aria-hidden>
                    <i className={returnStatusIcon(stage)} />
                  </span>
                  <div className="return-timeline__body">
                    <p className="return-timeline__title">{formatReturnStatus(stage)}</p>
                    {stage === 'AwaitingPickup' && item.status === 'SellerConfirmed' ? (
                      <p className="return-timeline__note return-timeline__note--pending">
                        <i className="fa-solid fa-circle-notch fa-spin" aria-hidden />{' '}
                        Scheduling shipper pickup…
                      </p>
                    ) : (stage === 'Refunded' || stage === 'Exchanged') &&
                      item.status === 'Accepted' ? (
                      <p className="return-timeline__note return-timeline__note--pending">
                        <i className="fa-solid fa-circle-notch fa-spin" aria-hidden />{' '}
                        AIDR support is processing your{' '}
                        {item.resolutionType === 'Exchange' ? 'exchange' : 'refund'}…
                      </p>
                    ) : (
                      <p className="return-timeline__time">Not yet</p>
                    )}
                  </div>
                </li>
              ))}
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
