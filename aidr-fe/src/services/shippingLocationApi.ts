import type { ShippingLocationApiResult } from '../types/shippingLocation';
import { apiClient } from './apiClient';

export async function getProvinces() {
  const { data } = await apiClient.get<ShippingLocationApiResult>('/shipping/locations/provinces');
  return data;
}

export async function getDistricts(provinceId: string) {
  const { data } = await apiClient.get<ShippingLocationApiResult>(
    `/shipping/locations/provinces/${encodeURIComponent(provinceId)}/districts`,
  );
  return data;
}

export async function getWards(districtId: string) {
  const { data } = await apiClient.get<ShippingLocationApiResult>(
    `/shipping/locations/districts/${encodeURIComponent(districtId)}/wards`,
  );
  return data;
}
