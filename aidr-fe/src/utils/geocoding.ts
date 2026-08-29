import type { LatLng } from '../types/shippingLocation';

/**
 * Photon geocoding (OSM data, run by Komoot).
 *
 * Free and key-less like Nominatim, but on a host that Vietnamese networks
 * actually resolve — `nominatim.openstreetmap.org` times out on many of them,
 * which made every lookup fail silently and left the pin wherever it was.
 * Calls still go through a single queue so we stay a polite client.
 *
 * Results are advisory: the buyer's picks from the carrier's own list always
 * win, and a failed lookup only means the map does not move.
 */
const PHOTON = 'https://photon.komoot.io';
const MIN_GAP_MS = 400;

/** Roughly the centre of Vietnam's two biggest cities, used before anything is picked. */
export const VN_DEFAULT_CENTER: LatLng = { lat: 21.0278, lng: 105.8342 };

/** Keeps a search for "Ward 5" from landing in another country. */
const VN_BBOX = '102.1,8.2,109.6,23.5';

export type ReverseGeocodeResult = {
  displayName: string;
  street: string | null;
  ward: string | null;
  district: string | null;
  province: string | null;
};

type PhotonProperties = {
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  district?: string;
  county?: string;
  city?: string;
  state?: string;
  country?: string;
  countrycode?: string;
};

type PhotonFeature = {
  properties?: PhotonProperties;
  geometry?: { coordinates?: [number, number] };
};

type PhotonResponse = { features?: PhotonFeature[] };

let lastCallAt = 0;

async function throttled<T>(run: () => Promise<T>): Promise<T> {
  const wait = Math.max(0, lastCallAt + MIN_GAP_MS - Date.now());
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCallAt = Date.now();
  return run();
}

/**
 * Strip the administrative prefix and diacritics so "Phường Dịch Vọng" and
 * "Dich Vong" compare equal — the carrier and OSM rarely agree on either.
 */
export function normalizeAdminName(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(
      /\b(thanh pho|tinh|quan|huyen|thi xa|thi tran|phuong|xa|tp\.?|q\.?|p\.?|city|province|district|ward)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Best match for an OSM name inside a carrier list; null when nothing is close. */
export function matchLocation<T extends { name: string }>(
  options: readonly T[],
  osmName: string | null | undefined,
): T | null {
  const target = normalizeAdminName(osmName);
  if (!target) return null;

  const exact = options.find((o) => normalizeAdminName(o.name) === target);
  if (exact) return exact;

  // "Hanoi" and "Hà Nội" only meet once the spaces go too.
  const squashed = target.replace(/ /g, '');
  const squashedMatch = options.find(
    (o) => normalizeAdminName(o.name).replace(/ /g, '') === squashed,
  );
  if (squashedMatch) return squashedMatch;

  return (
    options.find((o) => {
      const name = normalizeAdminName(o.name);
      return name.length > 2 && (name.includes(target) || target.includes(name));
    }) ?? null
  );
}

function pointOf(feature: PhotonFeature | undefined): LatLng | null {
  const coords = feature?.geometry?.coordinates;
  if (!coords) return null;
  const [lng, lat] = coords;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function readFeatures(url: URL, signal?: AbortSignal): Promise<PhotonFeature[]> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) return [];
  const body = (await response.json()) as PhotonResponse;
  return body.features ?? [];
}

export async function geocodeAddress(query: string, signal?: AbortSignal): Promise<LatLng | null> {
  const q = query.trim();
  if (q.length < 6) return null;

  return throttled(async () => {
    const url = new URL(`${PHOTON}/api/`);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '5');
    url.searchParams.set('bbox', VN_BBOX);

    const features = await readFeatures(url, signal);
    // The bbox is a hint, not a filter — drop anything that landed abroad.
    const inVietnam = features.find((f) => f.properties?.countrycode === 'VN');
    return pointOf(inVietnam ?? features[0]);
  });
}

export async function reverseGeocode(
  point: LatLng,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult | null> {
  return throttled(async () => {
    const url = new URL(`${PHOTON}/reverse`);
    url.searchParams.set('lat', String(point.lat));
    url.searchParams.set('lon', String(point.lng));
    url.searchParams.set('limit', '1');

    const features = await readFeatures(url, signal);
    const p = features[0]?.properties;
    if (!p) return null;

    const street = [p.housenumber ?? '', p.street ?? p.name ?? ''].filter(Boolean).join(' ').trim();

    return {
      displayName: [street, p.locality ?? p.suburb, p.district ?? p.county, p.city ?? p.state]
        .filter(Boolean)
        .join(', '),
      street: street || null,
      // OSM spreads Vietnamese wards and districts over several keys.
      ward: p.locality ?? p.suburb ?? p.quarter ?? p.neighbourhood ?? null,
      district: p.district ?? p.county ?? null,
      province: p.city ?? p.state ?? null,
    };
  });
}
