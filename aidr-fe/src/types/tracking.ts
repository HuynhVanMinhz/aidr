import type { LatLng } from './shippingLocation';

/** A pinned point, or null when nobody has pinned that end yet. */
export type GeoPoint = LatLng;

/**
 * The two ends of a delivery.
 *
 * The carrier reports a status, never a courier position, so the tracking map
 * draws the parcel along this line at the point its status implies rather than
 * at a GPS fix. Either end can be missing.
 */
export type OrderRoute = {
  pickup?: GeoPoint | null;
  pickupLabel: string;
  destination?: GeoPoint | null;
  destinationLabel: string;
};

export type TrackingEvent = {
  shipmentEventId: string;
  providerStatus: string;
  mappedStatus: string;
  description?: string | null;
  source: string;
  occurredAt: string;
};

/** What the buyer sees about the parcel; the seller gets the retry counts too. */
export type BuyerOrderTracking = {
  carrier: string;
  trackingCode?: string | null;
  shipmentStatus?: string | null;
  expectedDeliveryAt?: string | null;
  lastUpdateAt?: string | null;
  route: OrderRoute;
  events: TrackingEvent[];
};

/**
 * How far along the route the parcel is drawn, per shipment status.
 *
 * These are positions on a picture, not measurements - the carrier never says
 * where the parcel physically is, and the UI says so next to the map.
 */
const PROGRESS_BY_SHIPMENT_STATUS: Record<string, number> = {
  Pending: 0,
  Created: 0.06,
  PickedUp: 0.3,
  InTransit: 0.68,
  Delivered: 1,
  Failed: 0.68,
  Returned: 0.3,
  Cancelled: 0,
};

/** Fallback for orders with no shipment row - the order's own status still tells a story. */
const PROGRESS_BY_ORDER_STATUS: Record<string, number> = {
  PendingPayment: 0,
  Paid: 0,
  Confirmed: 0.06,
  Shipping: 0.68,
  Delivered: 1,
  Completed: 1,
  Cancelled: 0,
  ReturnRequested: 1,
  Returned: 0.3,
};

export function routeProgress(
  shipmentStatus?: string | null,
  orderStatus?: string | null,
): number {
  if (shipmentStatus && shipmentStatus in PROGRESS_BY_SHIPMENT_STATUS) {
    return PROGRESS_BY_SHIPMENT_STATUS[shipmentStatus];
  }
  if (orderStatus && orderStatus in PROGRESS_BY_ORDER_STATUS) {
    return PROGRESS_BY_ORDER_STATUS[orderStatus];
  }
  return 0;
}

/** True once the parcel has left the shop, which is when the moving pin makes sense. */
export function isParcelMoving(shipmentStatus?: string | null, orderStatus?: string | null) {
  const progress = routeProgress(shipmentStatus, orderStatus);
  return progress > 0 && progress < 1;
}
