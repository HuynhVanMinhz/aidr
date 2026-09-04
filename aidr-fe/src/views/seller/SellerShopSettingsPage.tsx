import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AddressMapPicker } from '../../components/address/AddressMapPicker';
import { FormField } from '../../components/admin/FormField';
import { ImageDropzone } from '../../components/admin/ImageDropzone';
import { OpeningHoursField } from '../../components/admin/OpeningHoursField';
import { useShippingLocations } from '../../hooks/useShippingLocations';
import { useToast } from '../../hooks/useToast';
import { getMyShop, requireSellerShop, updateMyShop } from '../../services/sellerApi';
import type { SellerShop } from '../../types/sellerShop';
import type { LatLng } from '../../types/shippingLocation';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  isCloudinaryConfigured,
  uploadShopImageToCloudinary,
  validateShopImageFile,
} from '../../utils/cloudinaryUpload';
import { visibleFieldErrors } from '../../utils/formValidation';
import { reverseGeocode } from '../../utils/geocoding';
import {
  canSubmitSellerShopForm,
  emptySellerShopForm,
  sellerShopFormToPayload,
  validateSellerShopForm,
  type SellerShopFormField,
  type SellerShopFormValues,
} from '../../utils/sellerShopValidation';

function shopToForm(shop: SellerShop): SellerShopFormValues {
  return emptySellerShopForm({
    shopName: shop.shopName,
    tagline: shop.tagline ?? '',
    shortDescription: shop.shortDescription ?? '',
    description: shop.description ?? '',
    logoUrl: shop.logoUrl ?? '',
    bannerUrl: shop.bannerUrl ?? '',
    email: shop.email ?? '',
    phone: shop.phone ?? '',
    hotline: shop.hotline ?? '',
    province: shop.province ?? '',
    district: shop.district ?? '',
    ward: shop.ward ?? '',
    streetAddress: shop.streetAddress ?? '',
    returnPolicy: shop.returnPolicy ?? '',
    shippingPolicy: shop.shippingPolicy ?? '',
    websiteUrl: shop.websiteUrl ?? '',
    facebookUrl: shop.facebookUrl ?? '',
    openingHoursJson: shop.openingHoursJson ?? '',
  });
}

export function SellerShopSettingsPage() {
  const toast = useToast();
  const [shop, setShop] = useState<SellerShop | null>(null);
  const [form, setForm] = useState<SellerShopFormValues>(emptySellerShopForm());
  const [initial, setInitial] = useState<SellerShopFormValues>(emptySellerShopForm());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<SellerShopFormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  // Kept beside the form rather than in it: the form values are all strings, and
  // a coordinate that round-trips through a string loses precision for no gain.
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null);
  const [initialPickupPoint, setInitialPickupPoint] = useState<LatLng | null>(null);
  const [pickupCaption, setPickupCaption] = useState<string | null>(null);
  const [imageError, setImageError] = useState<Partial<Record<'logoUrl' | 'bannerUrl', string>>>({});
  // Without Cloudinary keys there is nowhere to upload to; the URL field still works.
  const uploadsEnabled = isCloudinaryConfigured();
  const [pickupBusy, setPickupBusy] = useState(false);

  // Same carrier-backed lists the buyer picks a delivery address from, so a shop
  // address is spelled the way the carrier will accept when a booking is made.
  const locations = useShippingLocations();
  // Until a dropdown is touched, a saved shop keeps the names it was stored with:
  // the carrier lists may not resolve them, and blanking the field silently would
  // be worse than showing an empty select beside the value.
  const [locationsTouched, setLocationsTouched] = useState(false);

  const {
    provinceId,
    districtId,
    wardId,
    provinceName,
    districtName,
    wardName,
    seed,
  } = locations;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void getMyShop()
      .then((result) => {
        if (cancelled) return;
        const data = requireSellerShop(result);
        setShop(data);
        const values = shopToForm(data);
        setForm(values);
        setInitial(values);
        setLocationsTouched(false);
        seed({ province: values.province, district: values.district, ward: values.ward });
        const loadedPoint =
          data.latitude != null && data.longitude != null
            ? { lat: data.latitude, lng: data.longitude }
            : null;
        setPickupPoint(loadedPoint);
        setInitialPickupPoint(loadedPoint);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seed]);

  // Carrier spelling wins once a unit resolves. This mirrors names into the form
  // without touching `dirty` — resolving what was already saved is not an edit.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      province: provinceId ? provinceName : locationsTouched ? '' : prev.province,
      district: districtId ? districtName : locationsTouched ? '' : prev.district,
      ward: wardId ? wardName : locationsTouched ? '' : prev.ward,
    }));
  }, [provinceId, districtId, wardId, provinceName, districtName, wardName, locationsTouched]);

  const fieldErrors = useMemo(() => validateSellerShopForm(form), [form]);
  const visibleErrors = visibleFieldErrors(fieldErrors, touched, submitted);
  const canSubmit = canSubmitSellerShopForm(dirty, fieldErrors, form.shopName);

  // Save is disabled while anything is invalid, and an untouched field's error
  // is otherwise invisible — a shop seeded with an odd URL looked simply broken.
  const blockingErrors = useMemo(() => Object.values(fieldErrors), [fieldErrors]);

  function updateField<K extends SellerShopFormField>(key: K, value: string) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * The pin is where the carrier actually collects, so the written address
   * follows it rather than the other way round; a pin and an address that
   * disagree send the driver to the wrong street.
   */
  function handlePickPickup(next: LatLng) {
    setDirty(true);
    setPickupPoint(next);
    setPickupBusy(true);

    void reverseGeocode(next)
      .then((result) => {
        if (!result) return;
        setPickupCaption(result.displayName || null);
        setForm((prev) => ({
          ...prev,
          streetAddress: result.street ?? prev.streetAddress,
          ward: result.ward ?? prev.ward,
          district: result.district ?? prev.district,
          province: result.province ?? prev.province,
        }));
        // OSM's spelling only stands in until the carrier lists resolve the same
        // names into selections; what they cannot match keeps the name above.
        setLocationsTouched(false);
        seed({
          province: result.province ?? undefined,
          district: result.district ?? undefined,
          ward: result.ward ?? undefined,
        });
      })
      .catch(() => undefined)
      .finally(() => setPickupBusy(false));
  }

  /** A finished upload is an edit like any other, and clears the last failure. */
  function pickShopImage(key: 'logoUrl' | 'bannerUrl', url: string) {
    setImageError((prev) => ({ ...prev, [key]: undefined }));
    updateField(key, url);
    markTouched(key);
    toast.success(key === 'logoUrl' ? 'Logo uploaded.' : 'Banner uploaded.');
  }

  function markTouched(key: SellerShopFormField) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setSubmitError(null);

    const errors = validateSellerShopForm(form);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await updateMyShop({
        ...sellerShopFormToPayload(form),
        latitude: pickupPoint?.lat ?? null,
        longitude: pickupPoint?.lng ?? null,
      });
      const data = requireSellerShop(result);
      setShop(data);
      const values = shopToForm(data);
      setForm(values);
      setInitial(values);
      setLocationsTouched(false);
      seed({ province: values.province, district: values.district, ward: values.ward });
      setInitialPickupPoint(pickupPoint);
      setDirty(false);
      setSubmitted(false);
      toast.success('Shop settings saved.');
    } catch (err) {
      const message = getApiErrorMessage(err);
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-muted">Loading shop settings…</p>;
  }

  if (loadError || !shop) {
    return (
      <div className="alert alert-danger" role="alert">
        {loadError || 'Unable to load shop settings.'}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">Shop settings</h4>
              <Link to={`/shops/${shop.slug}`} className="btn btn-sm btn-outline-light" target="_blank">
                View public shop
              </Link>
            </div>
            <div className="card-body">
              {submitError ? (
                <div className="alert alert-danger" role="alert">
                  {submitError}
                </div>
              ) : null}

              <div className="row">
                <div className="col-lg-6">
                  <FormField label="Shop slug" htmlFor="shop-slug">
                    <input id="shop-slug" type="text" className="form-control" value={shop.slug} readOnly />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Shop name *" htmlFor="shop-name" error={visibleErrors.shopName}>
                    <input
                      id="shop-name"
                      type="text"
                      className="form-control"
                      value={form.shopName}
                      onChange={(e) => updateField('shopName', e.target.value)}
                      onBlur={() => markTouched('shopName')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Tagline" htmlFor="shop-tagline" error={visibleErrors.tagline}>
                    <input
                      id="shop-tagline"
                      type="text"
                      className="form-control"
                      value={form.tagline}
                      onChange={(e) => updateField('tagline', e.target.value)}
                      onBlur={() => markTouched('tagline')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Email" htmlFor="shop-email" error={visibleErrors.email}>
                    <input
                      id="shop-email"
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      onBlur={() => markTouched('email')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Phone" htmlFor="shop-phone" error={visibleErrors.phone}>
                    <input
                      id="shop-phone"
                      type="text"
                      className="form-control"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      onBlur={() => markTouched('phone')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Hotline" htmlFor="shop-hotline" error={visibleErrors.hotline}>
                    <input
                      id="shop-hotline"
                      type="text"
                      className="form-control"
                      value={form.hotline}
                      onChange={(e) => updateField('hotline', e.target.value)}
                      onBlur={() => markTouched('hotline')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-12">
                  <FormField
                    label="Short description"
                    htmlFor="shop-short-description"
                    error={visibleErrors.shortDescription}
                  >
                    <textarea
                      id="shop-short-description"
                      className="form-control"
                      rows={2}
                      value={form.shortDescription}
                      onChange={(e) => updateField('shortDescription', e.target.value)}
                      onBlur={() => markTouched('shortDescription')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-12">
                  <FormField label="Description" htmlFor="shop-description" error={visibleErrors.description}>
                    <textarea
                      id="shop-description"
                      className="form-control"
                      rows={4}
                      value={form.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      onBlur={() => markTouched('description')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Logo"
                    htmlFor="shop-logo-file"
                    error={imageError.logoUrl ?? visibleErrors.logoUrl}
                  >
                    <ImageDropzone
                      id="shop-logo-file"
                      value={form.logoUrl}
                      onChange={(url) => pickShopImage('logoUrl', url)}
                      upload={uploadShopImageToCloudinary}
                      validate={validateShopImageFile}
                      disabled={submitting || !uploadsEnabled}
                      emptyLabel={uploadsEnabled ? 'Drop your logo here' : 'Uploads unavailable'}
                      hint={
                        uploadsEnabled
                          ? 'Square works best · PNG or JPG · up to 4MB'
                          : 'Image hosting is not configured — paste a URL below instead.'
                      }
                      previewAlt="Shop logo preview"
                      onError={(message) => setImageError((e) => ({ ...e, logoUrl: message }))}
                    />
                  </FormField>
                  <input
                    id="shop-logo"
                    type="text"
                    className="form-control form-control-sm mt-n2 mb-3"
                    value={form.logoUrl}
                    placeholder="…or paste an image URL"
                    aria-label="Logo URL"
                    onChange={(e) => updateField('logoUrl', e.target.value)}
                    onBlur={() => markTouched('logoUrl')}
                  />
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Banner"
                    htmlFor="shop-banner-file"
                    error={imageError.bannerUrl ?? visibleErrors.bannerUrl}
                  >
                    <ImageDropzone
                      id="shop-banner-file"
                      value={form.bannerUrl}
                      onChange={(url) => pickShopImage('bannerUrl', url)}
                      upload={uploadShopImageToCloudinary}
                      validate={validateShopImageFile}
                      disabled={submitting || !uploadsEnabled}
                      emptyLabel={uploadsEnabled ? 'Drop your banner here' : 'Uploads unavailable'}
                      hint={
                        uploadsEnabled
                          ? 'Wide crop, around 3:1 · PNG or JPG · up to 4MB'
                          : 'Image hosting is not configured — paste a URL below instead.'
                      }
                      previewAlt="Shop banner preview"
                      onError={(message) => setImageError((e) => ({ ...e, bannerUrl: message }))}
                    />
                  </FormField>
                  <input
                    id="shop-banner"
                    type="text"
                    className="form-control form-control-sm mt-n2 mb-3"
                    value={form.bannerUrl}
                    placeholder="…or paste an image URL"
                    aria-label="Banner URL"
                    onChange={(e) => updateField('bannerUrl', e.target.value)}
                    onBlur={() => markTouched('bannerUrl')}
                  />
                </div>
                <div className="col-lg-6">
                  <FormField label="Province / City" htmlFor="shop-province" error={visibleErrors.province}>
                    <select
                      id="shop-province"
                      className="form-select"
                      value={provinceId}
                      disabled={locations.loadingProvinces}
                      onChange={(e) => {
                        setDirty(true);
                        setLocationsTouched(true);
                        markTouched('province');
                        locations.selectProvince(e.target.value);
                      }}
                    >
                      <option value="">
                        {locations.loadingProvinces ? 'Loading…' : 'Select province / city'}
                      </option>
                      {locations.provinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {!provinceId && form.province ? (
                    <p className="text-muted fs-13 mt-n2 mb-3">Saved as “{form.province}”</p>
                  ) : null}
                </div>
                <div className="col-lg-6">
                  <FormField label="District" htmlFor="shop-district" error={visibleErrors.district}>
                    <select
                      id="shop-district"
                      className="form-select"
                      value={districtId}
                      disabled={!provinceId || locations.loadingDistricts}
                      onChange={(e) => {
                        setDirty(true);
                        setLocationsTouched(true);
                        markTouched('district');
                        locations.selectDistrict(e.target.value);
                      }}
                    >
                      <option value="">
                        {!provinceId
                          ? 'Pick a province first'
                          : locations.loadingDistricts
                            ? 'Loading…'
                            : locations.districts.length === 0
                              ? 'No districts listed'
                              : 'Select district'}
                      </option>
                      {locations.districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {!districtId && form.district ? (
                    <p className="text-muted fs-13 mt-n2 mb-3">Saved as “{form.district}”</p>
                  ) : null}
                </div>
                <div className="col-lg-6">
                  <FormField label="Ward" htmlFor="shop-ward" error={visibleErrors.ward}>
                    <select
                      id="shop-ward"
                      className="form-select"
                      value={wardId}
                      disabled={!districtId || locations.loadingWards}
                      onChange={(e) => {
                        setDirty(true);
                        setLocationsTouched(true);
                        markTouched('ward');
                        locations.selectWard(e.target.value);
                      }}
                    >
                      <option value="">
                        {!districtId
                          ? 'Pick a district first'
                          : locations.loadingWards
                            ? 'Loading…'
                            : locations.wards.length === 0
                              ? 'No wards listed'
                              : 'Select ward'}
                      </option>
                      {locations.wards.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {!wardId && form.ward ? (
                    <p className="text-muted fs-13 mt-n2 mb-3">Saved as “{form.ward}”</p>
                  ) : null}
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Street address"
                    htmlFor="shop-street"
                    error={visibleErrors.streetAddress}
                  >
                    <input
                      id="shop-street"
                      type="text"
                      className="form-control"
                      value={form.streetAddress}
                      onChange={(e) => updateField('streetAddress', e.target.value)}
                      onBlur={() => markTouched('streetAddress')}
                    />
                  </FormField>
                </div>
                <div className="col-12">
                  <AddressMapPicker
                    point={pickupPoint}
                    onPick={handlePickPickup}
                    busy={pickupBusy}
                    title="Pin the pickup point"
                    hint="Click the map or drag the pin. The carrier collects from here, and the address fields above follow it."
                    caption={
                      pickupPoint
                        ? pickupCaption ||
                          'This is where the carrier collects parcels, and where the buyer’s tracking map starts.'
                        : 'No pickup pin yet — without one the order tracking map has nowhere to start.'
                    }
                  />
                </div>
                <div className="col-lg-6">
                  <FormField label="Website URL" htmlFor="shop-website" error={visibleErrors.websiteUrl}>
                    <input
                      id="shop-website"
                      type="url"
                      className="form-control"
                      value={form.websiteUrl}
                      onChange={(e) => updateField('websiteUrl', e.target.value)}
                      onBlur={() => markTouched('websiteUrl')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Facebook URL" htmlFor="shop-facebook" error={visibleErrors.facebookUrl}>
                    <input
                      id="shop-facebook"
                      type="url"
                      className="form-control"
                      value={form.facebookUrl}
                      onChange={(e) => updateField('facebookUrl', e.target.value)}
                      onBlur={() => markTouched('facebookUrl')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-12">
                  <FormField
                    label="Return policy"
                    htmlFor="shop-return-policy"
                    error={visibleErrors.returnPolicy}
                  >
                    <textarea
                      id="shop-return-policy"
                      className="form-control"
                      rows={3}
                      value={form.returnPolicy}
                      onChange={(e) => updateField('returnPolicy', e.target.value)}
                      onBlur={() => markTouched('returnPolicy')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-12">
                  <FormField
                    label="Shipping policy"
                    htmlFor="shop-shipping-policy"
                    error={visibleErrors.shippingPolicy}
                  >
                    <textarea
                      id="shop-shipping-policy"
                      className="form-control"
                      rows={3}
                      value={form.shippingPolicy}
                      onChange={(e) => updateField('shippingPolicy', e.target.value)}
                      onBlur={() => markTouched('shippingPolicy')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-12">
                  <FormField label="Opening hours" error={visibleErrors.openingHoursJson}>
                    <OpeningHoursField
                      id="shop-opening-hours"
                      value={form.openingHoursJson}
                      invalid={Boolean(visibleErrors.openingHoursJson)}
                      onChange={(json) => updateField('openingHoursJson', json)}
                      onBlur={() => markTouched('openingHoursJson')}
                    />
                  </FormField>
                </div>
              </div>
            </div>
            <div className="card-footer d-flex flex-wrap justify-content-end align-items-center gap-2">
              {dirty && blockingErrors.length > 0 ? (
                <p className="text-danger mb-0 me-auto fs-14">
                  Cannot save yet: {blockingErrors.join(' ')}
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-outline-light"
                disabled={!dirty || submitting}
                onClick={() => {
                  setForm(initial);
                  setLocationsTouched(false);
                  seed({
                    province: initial.province,
                    district: initial.district,
                    ward: initial.ward,
                  });
                  setPickupPoint(initialPickupPoint);
                  setPickupCaption(null);
                  setDirty(false);
                  setSubmitted(false);
                  setTouched({});
                }}
              >
                Reset
              </button>
              <button type="submit" className="btn btn-primary" disabled={!canSubmit || submitting}>
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
