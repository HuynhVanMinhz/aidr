import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { GeoPoint, OrderRoute } from '../../types/tracking';
import { VN_DEFAULT_CENTER } from '../../utils/geocoding';
import { attachBaseLayer } from '../../utils/mapTiles';

type OrderTrackingMapProps = {
  route: OrderRoute;
  /** 0 = still at the shop, 1 = delivered. Anything between draws the parcel on the line. */
  progress: number;
  /** What the parcel marker says on hover, e.g. "In transit". */
  parcelLabel: string;
  /** Shown instead of the map when neither end has been pinned. */
  emptyHint: string;
  height?: number;
};

/** Enough segments that the arc reads as a curve rather than a chain of chords. */
const CURVE_STEPS = 64;

const pickupIcon = L.divIcon({
  className: 'track-map__marker track-map__marker--pickup',
  html: '<i class="fa-solid fa-store" aria-hidden></i>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const destinationIcon = L.divIcon({
  className: 'track-map__marker track-map__marker--destination',
  html: '<i class="fa-solid fa-house" aria-hidden></i>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const parcelIcon = L.divIcon({
  className: 'track-map__marker track-map__marker--parcel',
  html: '<i class="fa-solid fa-truck-fast" aria-hidden></i>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

/**
 * A gentle arc between the two ends.
 *
 * A straight line invites the reader to measure it; a curve reads as "this is
 * roughly the journey", which is all the carrier's status stream can support.
 */
function curveBetween(from: GeoPoint, to: GeoPoint): L.LatLngTuple[] {
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;

  // Bow the control point out perpendicular to the line, by a tenth of its length.
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const controlLat = midLat - dLng * 0.1;
  const controlLng = midLng + dLat * 0.1;

  const points: L.LatLngTuple[] = [];
  for (let step = 0; step <= CURVE_STEPS; step += 1) {
    points.push(pointOnCurve(from, to, controlLat, controlLng, step / CURVE_STEPS));
  }
  return points;
}

function pointOnCurve(
  from: GeoPoint,
  to: GeoPoint,
  controlLat: number,
  controlLng: number,
  t: number,
): L.LatLngTuple {
  const inverse = 1 - t;
  const lat = inverse * inverse * from.lat + 2 * inverse * t * controlLat + t * t * to.lat;
  const lng = inverse * inverse * from.lng + 2 * inverse * t * controlLng + t * t * to.lng;
  return [lat, lng];
}

export function OrderTrackingMap({
  route,
  progress,
  parcelLabel,
  emptyHint,
  height = 300,
}: OrderTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  const pickup = route.pickup ?? null;
  const destination = route.destination ?? null;
  const hasAnyPoint = Boolean(pickup || destination);

  useEffect(() => {
    if (!hasAnyPoint || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      // Leaflet refuses to add any layer before it has a view, so start on
      // Vietnam; the effect below immediately fits the map to the real route.
      center: [VN_DEFAULT_CENTER.lat, VN_DEFAULT_CENTER.lng],
      zoom: 6,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    const baseLayer = attachBaseLayer(map);
    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      baseLayer.destroy();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [hasAnyPoint]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    if (pickup && destination) {
      const curve = curveBetween(pickup, destination);

      L.polyline(curve, {
        className: 'track-map__route',
        weight: 3,
        opacity: 0.85,
        dashArray: '7 7',
      }).addTo(layers);

      // The travelled part is solid, so "how far along" is readable at a glance.
      const travelled = curve.slice(0, Math.max(2, Math.round(curve.length * progress)));
      if (progress > 0) {
        L.polyline(travelled, {
          className: 'track-map__route track-map__route--done',
          weight: 4,
          opacity: 1,
        }).addTo(layers);
      }
    }

    if (pickup) {
      L.marker([pickup.lat, pickup.lng], { icon: pickupIcon })
        .bindTooltip(route.pickupLabel || 'Pickup point')
        .addTo(layers);
    }

    if (destination) {
      L.marker([destination.lat, destination.lng], { icon: destinationIcon })
        .bindTooltip(route.destinationLabel || 'Delivery point')
        .addTo(layers);
    }

    // Only worth its own pin while it is genuinely between the two ends —
    // at either extreme it would just sit on top of another marker.
    if (pickup && destination && progress > 0 && progress < 1) {
      const midLat = (pickup.lat + destination.lat) / 2;
      const midLng = (pickup.lng + destination.lng) / 2;
      const position = pointOnCurve(
        pickup,
        destination,
        midLat - (destination.lng - pickup.lng) * 0.1,
        midLng + (destination.lat - pickup.lat) * 0.1,
        progress,
      );
      L.marker(position, { icon: parcelIcon, zIndexOffset: 500 })
        .bindTooltip(parcelLabel)
        .addTo(layers);
    }

    const points = [pickup, destination].filter((p): p is GeoPoint => Boolean(p));
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as L.LatLngTuple)), {
        padding: [40, 40],
      });
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
    }

    // The card can be laid out after the map is created; Leaflet needs telling.
    map.invalidateSize();
  }, [pickup, destination, progress, parcelLabel, route.pickupLabel, route.destinationLabel]);

  if (!hasAnyPoint) {
    return (
      <div className="track-map track-map--empty" style={{ minHeight: height }}>
        <i className="fa-solid fa-map-location-dot" aria-hidden />
        <p>{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="track-map">
      <div ref={containerRef} className="track-map__canvas" style={{ height }} />
      <ul className="track-map__legend">
        <li>
          <span className="track-map__key track-map__key--pickup" aria-hidden />
          {route.pickupLabel || 'Pickup point'}
        </li>
        <li>
          <span className="track-map__key track-map__key--destination" aria-hidden />
          {route.destinationLabel || 'Delivery point'}
        </li>
      </ul>
    </div>
  );
}
