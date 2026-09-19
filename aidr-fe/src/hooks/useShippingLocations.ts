import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../services/shippingLocationApi';
import type { ShippingLocation } from '../types/shippingLocation';
import { matchLocation } from '../utils/geocoding';

export type LocationNames = {
  province: string;
  district: string;
  ward: string;
};

/**
 * Province → district → ward, straight from the carrier, so a saved address is
 * always spelled the way the carrier will accept at booking time.
 *
 * `seed` takes the plain names off an existing address and walks them back to
 * selections as each list arrives - an address saved before this form existed
 * still opens with its dropdowns filled in.
 */
export function useShippingLocations() {
  const [provinces, setProvinces] = useState<ShippingLocation[]>([]);
  const [districts, setDistricts] = useState<ShippingLocation[]>([]);
  const [wards, setWards] = useState<ShippingLocation[]>([]);

  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [wardId, setWardId] = useState('');

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // Names still waiting for their list to arrive before they can be resolved.
  const pendingRef = useRef<Partial<LocationNames>>({});
  // Bumped by seed() so the province resolver re-runs against an already-loaded list.
  const [seedTick, setSeedTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingProvinces(true);

    void (async () => {
      try {
        const result = await api.getProvinces();
        if (cancelled) return;
        setProvinces(result.data ?? []);
      } catch {
        if (!cancelled) setProvinces([]);
      } finally {
        if (!cancelled) setLoadingProvinces(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      return;
    }

    let cancelled = false;
    setLoadingDistricts(true);

    void (async () => {
      try {
        const result = await api.getDistricts(provinceId);
        if (cancelled) return;
        setDistricts(result.data ?? []);
      } catch {
        if (!cancelled) setDistricts([]);
      } finally {
        if (!cancelled) setLoadingDistricts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provinceId]);

  useEffect(() => {
    if (!districtId) {
      setWards([]);
      return;
    }

    let cancelled = false;
    setLoadingWards(true);

    void (async () => {
      try {
        const result = await api.getWards(districtId);
        if (cancelled) return;
        setWards(result.data ?? []);
      } catch {
        if (!cancelled) setWards([]);
      } finally {
        if (!cancelled) setLoadingWards(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [districtId]);

  // Resolve whatever part of the seed the newly arrived list can answer.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending.province || provinces.length === 0) return;

    const match = matchLocation(provinces, pending.province);
    pendingRef.current = { ...pending, province: undefined };
    if (match) setProvinceId(match.id);
  }, [provinces, seedTick]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending.district || districts.length === 0) return;

    const match = matchLocation(districts, pending.district);
    pendingRef.current = { ...pending, district: undefined };
    if (match) setDistrictId(match.id);
  }, [districts]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending.ward || wards.length === 0) return;

    const match = matchLocation(wards, pending.ward);
    pendingRef.current = { ...pending, ward: undefined };
    if (match) setWardId(match.id);
  }, [wards]);

  const selectProvince = useCallback((id: string) => {
    setProvinceId(id);
    setDistrictId('');
    setWardId('');
  }, []);

  const selectDistrict = useCallback((id: string) => {
    setDistrictId(id);
    setWardId('');
  }, []);

  // A name that cannot be resolved yet stays pending; the effects above take it
  // the moment its list arrives, and the tick covers a list already in hand.
  const seed = useCallback((names: Partial<LocationNames>) => {
    pendingRef.current = { ...names };
    setProvinceId('');
    setDistrictId('');
    setWardId('');
    setSeedTick((tick) => tick + 1);
  }, []);

  const reset = useCallback(() => {
    pendingRef.current = {};
    setProvinceId('');
    setDistrictId('');
    setWardId('');
  }, []);

  const nameOf = useCallback(
    (list: ShippingLocation[], id: string) => list.find((i) => i.id === id)?.name ?? '',
    [],
  );

  return {
    provinces,
    districts,
    wards,
    provinceId,
    districtId,
    wardId,
    provinceName: nameOf(provinces, provinceId),
    districtName: nameOf(districts, districtId),
    wardName: nameOf(wards, wardId),
    loadingProvinces,
    loadingDistricts,
    loadingWards,
    selectProvince,
    selectDistrict,
    selectWard: setWardId,
    seed,
    reset,
  };
}
