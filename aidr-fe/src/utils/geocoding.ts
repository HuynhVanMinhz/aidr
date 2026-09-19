import type { LatLng } from '../types/shippingLocation';

/**
 * Photon geocoding (OSM data, run by Komoot).
 *
 * Free and key-less like Nominatim, but on a host that Vietnamese networks
 * actually resolve - `nominatim.openstreetmap.org` times out on many of them,
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

/**
 * Approximate centres for major Vietnamese provinces/cities.
 * Used as a location-bias hint so Photon ranks nearby results higher,
 * improving accuracy when the same street name appears in multiple cities.
 */
const PROVINCE_CENTERS: Record<string, LatLng> = {
  'hà nội': { lat: 21.0278, lng: 105.8342 },
  'ho chi minh': { lat: 10.7769, lng: 106.7009 },
  'hồ chí minh': { lat: 10.7769, lng: 106.7009 },
  'tp hcm': { lat: 10.7769, lng: 106.7009 },
  'đà nẵng': { lat: 16.0471, lng: 108.2062 },
  'da nang': { lat: 16.0471, lng: 108.2062 },
  'hải phòng': { lat: 20.8449, lng: 106.6881 },
  'cần thơ': { lat: 10.0452, lng: 105.7469 },
  'an giang': { lat: 10.5216, lng: 105.1259 },
  'bà rịa vũng tàu': { lat: 10.5417, lng: 107.2429 },
  'bắc giang': { lat: 21.2819, lng: 106.1975 },
  'bắc kạn': { lat: 22.1474, lng: 105.8348 },
  'bạc liêu': { lat: 9.2939, lng: 105.7247 },
  'bắc ninh': { lat: 21.1861, lng: 106.0763 },
  'bến tre': { lat: 10.2433, lng: 106.3752 },
  'bình định': { lat: 13.7765, lng: 109.2237 },
  'bình dương': { lat: 11.3254, lng: 106.477 },
  'bình phước': { lat: 11.7512, lng: 106.7235 },
  'bình thuận': { lat: 11.0904, lng: 108.0721 },
  'cà mau': { lat: 9.1769, lng: 105.1524 },
  'cao bằng': { lat: 22.666, lng: 106.2638 },
  'đắk lắk': { lat: 12.7106, lng: 108.2379 },
  'đắk nông': { lat: 12.0046, lng: 107.6898 },
  'điện biên': { lat: 21.386, lng: 103.0161 },
  'đồng nai': { lat: 11.0686, lng: 107.1676 },
  'đồng tháp': { lat: 10.4938, lng: 105.6882 },
  'gia lai': { lat: 13.9833, lng: 108.0 },
  'hà giang': { lat: 22.8233, lng: 104.9836 },
  'hà nam': { lat: 20.5836, lng: 105.9228 },
  'hà tĩnh': { lat: 18.3427, lng: 105.9077 },
  'hải dương': { lat: 20.9373, lng: 106.3145 },
  'hậu giang': { lat: 9.7579, lng: 105.6413 },
  'hòa bình': { lat: 20.6859, lng: 105.3375 },
  'hưng yên': { lat: 20.6464, lng: 106.0511 },
  'khánh hòa': { lat: 12.2585, lng: 109.0526 },
  'kiên giang': { lat: 10.0125, lng: 105.0809 },
  'kon tum': { lat: 14.3497, lng: 108.0005 },
  'lai châu': { lat: 22.3964, lng: 103.4583 },
  'lâm đồng': { lat: 11.9465, lng: 108.4419 },
  'lạng sơn': { lat: 21.8537, lng: 106.7615 },
  'lào cai': { lat: 22.4809, lng: 103.9753 },
  'long an': { lat: 10.6956, lng: 106.2431 },
  'nam định': { lat: 20.4242, lng: 106.1677 },
  'nghệ an': { lat: 19.2342, lng: 104.9200 },
  'ninh bình': { lat: 20.2538, lng: 105.9750 },
  'ninh thuận': { lat: 11.5646, lng: 108.9880 },
  'phú thọ': { lat: 21.4228, lng: 105.2282 },
  'phú yên': { lat: 13.0882, lng: 109.0929 },
  'quảng bình': { lat: 17.4689, lng: 106.5996 },
  'quảng nam': { lat: 15.5394, lng: 108.0191 },
  'quảng ngãi': { lat: 15.1203, lng: 108.8044 },
  'quảng ninh': { lat: 21.0064, lng: 107.2925 },
  'quảng trị': { lat: 16.7403, lng: 107.1854 },
  'sóc trăng': { lat: 9.6025, lng: 105.9739 },
  'sơn la': { lat: 21.3256, lng: 103.9188 },
  'tây ninh': { lat: 11.3101, lng: 106.0985 },
  'thái bình': { lat: 20.4463, lng: 106.3366 },
  'thái nguyên': { lat: 21.5942, lng: 105.8480 },
  'thanh hóa': { lat: 19.8079, lng: 105.7851 },
  'thừa thiên huế': { lat: 16.4637, lng: 107.5909 },
  'tiền giang': { lat: 10.4493, lng: 106.3420 },
  'trà vinh': { lat: 9.9477, lng: 106.3427 },
  'tuyên quang': { lat: 21.8230, lng: 105.2180 },
  'vĩnh long': { lat: 10.2537, lng: 105.9722 },
  'vĩnh phúc': { lat: 21.3089, lng: 105.6047 },
  'yên bái': { lat: 21.7051, lng: 104.9057 },
};

function provinceCenter(name: string | null | undefined): LatLng | undefined {
  if (!name) return undefined;
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(PROVINCE_CENTERS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return undefined;
}

/** Points awarded when a Photon feature's admin fields match the buyer's picks. */
const SCORE_DISTRICT = 100;
const SCORE_WARD = 40;
const SCORE_PROVINCE = 20;

export type ReverseGeocodeResult = {
  displayName: string;
  street: string | null;
  ward: string | null;
  district: string | null;
  province: string | null;
};

/** Optional admin context so "Lý Thánh Tông" lands in the selected district, not a namesake. */
export type GeocodePrefer = {
  province?: string | null;
  district?: string | null;
  ward?: string | null;
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
 * "Dich Vong" compare equal - the carrier and OSM rarely agree on either.
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

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeAdminName(a);
  const right = normalizeAdminName(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const leftFlat = left.replace(/ /g, '');
  const rightFlat = right.replace(/ /g, '');
  if (leftFlat === rightFlat) return true;

  return (
    (left.length > 2 && right.includes(left)) || (right.length > 2 && left.includes(right))
  );
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

/** OSM/Photon scatter VN admin labels across several keys - check them all. */
function featureAdminBag(props: PhotonProperties | undefined): string {
  if (!props) return '';
  return [
    props.locality,
    props.suburb,
    props.quarter,
    props.neighbourhood,
    props.district,
    props.county,
    props.city,
    props.state,
    props.name,
  ]
    .filter(Boolean)
    .join(' | ');
}

function scoreFeature(props: PhotonProperties | undefined, prefer?: GeocodePrefer): number {
  if (!props || !prefer) return 0;

  const bag = featureAdminBag(props);
  let score = 0;

  if (prefer.district?.trim()) {
    const districtKeys = [props.district, props.county, props.city, props.suburb];
    if (districtKeys.some((k) => namesMatch(k, prefer.district)) || namesMatch(bag, prefer.district)) {
      score += SCORE_DISTRICT;
    }
  }

  if (prefer.ward?.trim()) {
    const wardKeys = [props.locality, props.suburb, props.quarter, props.neighbourhood, props.name];
    if (wardKeys.some((k) => namesMatch(k, prefer.ward)) || namesMatch(bag, prefer.ward)) {
      score += SCORE_WARD;
    }
  }

  if (prefer.province?.trim()) {
    const provinceKeys = [props.city, props.state];
    if (provinceKeys.some((k) => namesMatch(k, prefer.province)) || namesMatch(bag, prefer.province)) {
      score += SCORE_PROVINCE;
    }
  }

  return score;
}

function pickBestFeature(
  features: PhotonFeature[],
  prefer?: GeocodePrefer,
): PhotonFeature | undefined {
  const inVietnam = features.filter(
    (f) => !f.properties?.countrycode || f.properties.countrycode === 'VN',
  );
  const pool = inVietnam.length > 0 ? inVietnam : features;
  if (pool.length === 0) return undefined;

  const ranked = [...pool]
    .map((feature, index) => ({
      feature,
      // Stable tie-break: Photon already ranks by relevance to the query text.
      score: scoreFeature(feature.properties, prefer) * 1000 - index,
      adminScore: scoreFeature(feature.properties, prefer),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return undefined;

  // Same street name in two districts (e.g. Lý Thánh Tông in Ngũ Hành Sơn vs Sơn Trà):
  // if the buyer picked a district, never land on a namesake that does not match it.
  if (prefer?.district?.trim() && best.adminScore < SCORE_DISTRICT) {
    return undefined;
  }

  return best.feature;
}

async function readFeatures(url: URL, signal?: AbortSignal): Promise<PhotonFeature[]> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) return [];
  const body = (await response.json()) as PhotonResponse;
  return body.features ?? [];
}

export async function geocodeAddress(
  query: string,
  signal?: AbortSignal,
  prefer?: GeocodePrefer,
): Promise<LatLng | null> {
  const q = query.trim();
  if (q.length < 6) return null;

  return throttled(async () => {
    const center = provinceCenter(prefer?.province) ?? VN_DEFAULT_CENTER;

    const url = new URL(`${PHOTON}/api/`);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '10');
    url.searchParams.set('lang', 'vi');
    url.searchParams.set('bbox', VN_BBOX);
    // Bias toward the selected province so a street shared across cities resolves locally.
    url.searchParams.set('lat', String(center.lat));
    url.searchParams.set('lon', String(center.lng));

    const features = await readFeatures(url, signal);
    const point = pointOf(pickBestFeature(features, prefer));
    if (point) return point;

    // Second pass: when no street-level hit passes the district check, search by
    // district + province alone so the map can at least centre on the right area
    // rather than going completely blank.
    if (prefer?.district?.trim() && prefer?.province?.trim()) {
      const areaQuery = [prefer.district, prefer.province].join(', ');
      const fallback = new URL(`${PHOTON}/api/`);
      fallback.searchParams.set('q', areaQuery);
      fallback.searchParams.set('limit', '5');
      fallback.searchParams.set('lang', 'vi');
      fallback.searchParams.set('bbox', VN_BBOX);
      fallback.searchParams.set('lat', String(center.lat));
      fallback.searchParams.set('lon', String(center.lng));

      const fallbackFeatures = await readFeatures(fallback, signal);
      const inVN = fallbackFeatures.filter(
        (f) => !f.properties?.countrycode || f.properties.countrycode === 'VN',
      );
      // Return district centre as a soft pin only — the caption will still show
      // the full address so the buyer knows the street was not resolved exactly.
      return pointOf(inVN[0]);
    }

    return null;
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
    url.searchParams.set('lang', 'vi');

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
