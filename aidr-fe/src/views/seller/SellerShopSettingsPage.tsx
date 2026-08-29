import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AddressMapPicker } from '../../components/address/AddressMapPicker';
import { FormField } from '../../components/admin/FormField';
import { useToast } from '../../hooks/useToast';
import { getMyShop, requireSellerShop, updateMyShop } from '../../services/sellerApi';
import type { SellerShop } from '../../types/sellerShop';
import type { LatLng } from '../../types/shippingLocation';
import { getApiErrorMessage } from '../../utils/apiError';
import { visibleFieldErrors } from '../../utils/formValidation';
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
        setPickupPoint(
          data.latitude != null && data.longitude != null
            ? { lat: data.latitude, lng: data.longitude }
            : null,
        );
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
  }, []);

  const fieldErrors = useMemo(() => validateSellerShopForm(form), [form]);
  const visibleErrors = visibleFieldErrors(fieldErrors, touched, submitted);
  const canSubmit = canSubmitSellerShopForm(dirty, fieldErrors, form.shopName);

  function updateField<K extends SellerShopFormField>(key: K, value: string) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
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
                  <FormField label="Logo URL" htmlFor="shop-logo" error={visibleErrors.logoUrl}>
                    <input
                      id="shop-logo"
                      type="url"
                      className="form-control"
                      value={form.logoUrl}
                      onChange={(e) => updateField('logoUrl', e.target.value)}
                      onBlur={() => markTouched('logoUrl')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Banner URL" htmlFor="shop-banner" error={visibleErrors.bannerUrl}>
                    <input
                      id="shop-banner"
                      type="url"
                      className="form-control"
                      value={form.bannerUrl}
                      onChange={(e) => updateField('bannerUrl', e.target.value)}
                      onBlur={() => markTouched('bannerUrl')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Province" htmlFor="shop-province" error={visibleErrors.province}>
                    <input
                      id="shop-province"
                      type="text"
                      className="form-control"
                      value={form.province}
                      onChange={(e) => updateField('province', e.target.value)}
                      onBlur={() => markTouched('province')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="District" htmlFor="shop-district" error={visibleErrors.district}>
                    <input
                      id="shop-district"
                      type="text"
                      className="form-control"
                      value={form.district}
                      onChange={(e) => updateField('district', e.target.value)}
                      onBlur={() => markTouched('district')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Ward" htmlFor="shop-ward" error={visibleErrors.ward}>
                    <input
                      id="shop-ward"
                      type="text"
                      className="form-control"
                      value={form.ward}
                      onChange={(e) => updateField('ward', e.target.value)}
                      onBlur={() => markTouched('ward')}
                    />
                  </FormField>
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
                    onPick={(next) => {
                      setDirty(true);
                      setPickupPoint(next);
                    }}
                    caption={
                      pickupPoint
                        ? 'This is where the carrier collects parcels, and where the buyer’s tracking map starts.'
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
                  <FormField
                    label="Opening hours (JSON)"
                    htmlFor="shop-opening-hours"
                    error={visibleErrors.openingHoursJson}
                  >
                    <textarea
                      id="shop-opening-hours"
                      className="form-control"
                      rows={3}
                      placeholder='e.g. {"mon":"9:00-18:00","tue":"9:00-18:00"}'
                      value={form.openingHoursJson}
                      onChange={(e) => updateField('openingHoursJson', e.target.value)}
                      onBlur={() => markTouched('openingHoursJson')}
                    />
                  </FormField>
                </div>
              </div>
            </div>
            <div className="card-footer d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-light"
                disabled={!dirty || submitting}
                onClick={() => {
                  setForm(initial);
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
