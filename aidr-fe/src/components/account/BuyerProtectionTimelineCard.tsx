import { useEffect, useState } from 'react';
import type { BuyerProtectionTimeline } from '../../types/v2Features';
import {
  getBuyerProtectionTimeline,
  requireBuyerProtectionTimeline,
} from '../../services/orderProtectionApi';
import { formatOrderDate } from '../../utils/orderUi';

type Props = {
  orderId: string;
};

function stepClass(state: string) {
  switch (state) {
    case 'done':
      return 'order-timeline__step order-timeline__step--done';
    case 'current':
      return 'order-timeline__step order-timeline__step--current';
    case 'warning':
      return 'order-timeline__step order-timeline__step--warning';
    case 'cancelled':
      return 'order-timeline__step order-timeline__step--cancelled';
    default:
      return 'order-timeline__step';
  }
}

export function BuyerProtectionTimelineCard({ orderId }: Props) {
  const [timeline, setTimeline] = useState<BuyerProtectionTimeline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getBuyerProtectionTimeline(orderId)
      .then((result) => {
        if (cancelled) return;
        setTimeline(requireBuyerProtectionTimeline(result));
      })
      .catch(() => {
        if (!cancelled) setTimeline(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="account-card">
        <h2 className="account-card__title">Buyer protection</h2>
        <p className="account-muted">Loading protection timeline…</p>
      </div>
    );
  }

  if (!timeline) return null;

  return (
    <div className="account-card">
      <h2 className="account-card__title">Buyer protection</h2>
      <p className="account-muted">
        See where your order is in the purchase protection flow.
      </p>
      <ol className="order-timeline">
        {timeline.steps.map((step) => (
          <li key={step.key} className={stepClass(step.state)}>
            <span className="order-timeline__marker" aria-hidden />
            <div>
              <p className="order-timeline__title">{step.label}</p>
              {step.at && <p className="order-timeline__time">{formatOrderDate(step.at)}</p>}
              {step.dueAt && !step.at && (
                <p className="order-timeline__time">Due {formatOrderDate(step.dueAt)}</p>
              )}
              {step.detail && <p className="order-timeline__detail">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      {timeline.shipmentTrackingUrl && (
        <p className="account-card__actions">
          <a href={timeline.shipmentTrackingUrl} target="_blank" rel="noreferrer">
            Track shipment
          </a>
        </p>
      )}
    </div>
  );
}
