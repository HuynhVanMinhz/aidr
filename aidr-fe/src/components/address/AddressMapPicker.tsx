import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '../../types/shippingLocation';
import { VN_DEFAULT_CENTER } from '../../utils/geocoding';
import { attachBaseLayer } from '../../utils/mapTiles';

type AddressMapPickerProps = {
  /** Current pin, or null before anything has been located. */
  point: LatLng | null;
  /** Fired when the buyer drags the pin, clicks the map, or uses their device location. */
  onPick: (point: LatLng) => void;
  /** One line describing what the pin currently sits on. */
  caption?: string | null;
  /** Heading over the map; defaults to the buyer's delivery wording. */
  title?: string;
  /** One line under the heading saying what dropping a pin does here. */
  hint?: string;
  busy?: boolean;
};

const DEFAULT_ZOOM = 13;
const PICKED_ZOOM = 16;

/**
 * A Leaflet marker's default icon is loaded from bundler-relative image paths and
 * silently breaks under Vite. A div icon has no assets to lose.
 */
const pinIcon = L.divIcon({
  className: 'address-map__pin',
  html: '<span class="address-map__pin-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export function AddressMapPicker({
  point,
  onPick,
  caption,
  title = 'Pin the delivery point',
  hint = 'Click the map or drag the pin. Address fields follow the pin. When the form drives the map, the selected district wins over a street with the same name elsewhere.',
  busy,
}: AddressMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Create once. StrictMode mounts twice in dev, so the cleanup has to be real.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [VN_DEFAULT_CENTER.lat, VN_DEFAULT_CENTER.lng],
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: false,
    });

    const baseLayer = attachBaseLayer(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    mapRef.current = map;

    return () => {
      baseLayer.destroy();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Follow the pin the parent hands us, wherever it came from.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const latLng = L.latLng(point.lat, point.lng);

    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
    } else {
      const marker = L.marker(latLng, { icon: pinIcon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const next = marker.getLatLng();
        onPickRef.current({ lat: next.lat, lng: next.lng });
      });
      markerRef.current = marker;
    }

    map.setView(latLng, Math.max(map.getZoom(), PICKED_ZOOM));
    // Leaflet measures the container on create; a panel that opens later needs a nudge.
    map.invalidateSize();
  }, [point]);

  function handleLocateMe() {
    if (!navigator.geolocation) {
      setLocateError('This browser cannot share a location.');
      return;
    }

    setLocateError(null);
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onPickRef.current({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setLocateError('Location permission was denied — drag the pin instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="address-map">
      <div className="address-map__head">
        <div>
          <p className="address-map__title">{title}</p>
          <p className="address-map__hint">{hint}</p>
        </div>
        <button
          type="button"
          className="account-btn account-btn--secondary account-btn--sm"
          onClick={handleLocateMe}
          disabled={locating}
        >
          <i className="fa-solid fa-location-crosshairs" aria-hidden />
          {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      <div className="address-map__canvas-wrap">
        <div ref={containerRef} className="address-map__canvas" />
        {busy ? <span className="address-map__badge">Looking up…</span> : null}
      </div>

      {locateError ? <p className="address-map__error">{locateError}</p> : null}

      <p className="address-map__caption">
        {caption?.trim()
          ? caption
          : point
            ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            : 'No pin yet — pick a ward or click the map.'}
      </p>
    </div>
  );
}
