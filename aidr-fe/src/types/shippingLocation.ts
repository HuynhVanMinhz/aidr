import type { ApiResult } from './auth';

/**
 * One administrative unit as the carrier knows it. `name` is the spelling the
 * carrier accepts back, which is exactly what gets stored on the address - a
 * hand-typed ward is what makes a booking fail at dispatch time.
 */
export type ShippingLocation = {
  id: string;
  name: string;
};

export type ShippingLocationApiResult = ApiResult<ShippingLocation[]>;

/** A point on the map, in the order Leaflet uses. */
export type LatLng = {
  lat: number;
  lng: number;
};
