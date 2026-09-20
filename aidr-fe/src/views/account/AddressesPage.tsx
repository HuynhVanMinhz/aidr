import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AccountConfirmModal } from '../../components/account/AccountConfirmModal';
import { useProfile } from '../../hooks/useProfile';
import { useShippingLocations } from '../../hooks/useShippingLocations';
import { useToastMessage } from '../../hooks/useToastMessage';
import type { Address, AddressUpsert } from '../../types/profile';
import type { LatLng } from '../../types/shippingLocation';
import { reverseGeocode } from '../../utils/geocoding';
import { validateRequired, validateVnPhone } from '../../utils/validators';

const MAX_ADDRESSES = 10;

type AddressDialog =
  | { kind: 'confirm-delete'; addressId: string; label: string }
  | { kind: 'alert'; title: string; message: string };

const emptyForm: AddressUpsert = {
  receiverName: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  streetAddress: '',
  isDefault: false,
};

function formatAddressLine(address: Address): string {
  return `${address.streetAddress}, ${address.ward}, ${address.district}, ${address.province}`;
}

export function AddressesPage() {
  const { profile, loading, saving, updateProfile, clearError, getErrorMessage } = useProfile();
  const [form, setForm] = useState<AddressUpsert>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AddressDialog | null>(null);

  const locations = useShippingLocations();
  // Until the buyer touches a dropdown, a saved address keeps the names it was
  // stored with - the carrier lists may not resolve them, and losing them silently
  // would be worse than showing a blank select next to the value.
  const [locationsTouched, setLocationsTouched] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useToastMessage(formSuccess, 'success');

  function showAlert(message: string, title = 'Unable to update address') {
    clearError();
    setDialog({ kind: 'alert', title, message });
  }

  const addresses = useMemo(() => profile?.addresses ?? [], [profile?.addresses]);
  const canAddMore = addresses.length < MAX_ADDRESSES;

  const sortedAddresses = useMemo(
    () => [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [addresses],
  );

  const {
    provinceId,
    districtId,
    wardId,
    provinceName,
    districtName,
    wardName,
    seed,
    reset: resetLocations,
  } = locations;

  useEffect(() => {
    if (!editingId) return;

    const current = addresses.find((a) => a.addressId === editingId);
    if (!current) return;

    setForm({
      addressId: current.addressId,
      receiverName: current.receiverName,
      phone: current.phone,
      province: current.province,
      district: current.district,
      ward: current.ward,
      streetAddress: current.streetAddress,
      latitude: current.latitude ?? null,
      longitude: current.longitude ?? null,
      isDefault: current.isDefault,
    });
    setLocationsTouched(false);
    seed({
      province: current.province,
      district: current.district,
      ward: current.ward,
    });
    setShowForm(true);
  }, [addresses, editingId, seed]);

  // Carrier spelling wins once a unit resolves, so a saved "Hanoi" becomes the
  // name the carrier itself uses the next time this address is saved.
  useEffect(() => {
    setForm((f) => ({
      ...f,
      province: provinceId ? provinceName : locationsTouched ? '' : f.province,
      district: districtId ? districtName : locationsTouched ? '' : f.district,
      ward: wardId ? wardName : locationsTouched ? '' : f.ward,
    }));
  }, [provinceId, districtId, wardId, provinceName, districtName, wardName, locationsTouched]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setLocationsTouched(false);
    setLocateError(null);
    resetLocations();
  }

  function applyLocationPoint(point: LatLng) {
    setForm((f) => ({
      ...f,
      latitude: point.lat,
      longitude: point.lng,
    }));
    setLocating(true);
    setLocateError(null);

    void reverseGeocode(point)
      .then((result) => {
        if (!result) {
          setLocateError('Could not resolve this location to an address.');
          return;
        }
        setForm((f) => ({
          ...f,
          streetAddress: result.street ?? f.streetAddress,
          province: result.province ?? f.province,
          district: result.district ?? f.district,
          ward: result.ward ?? f.ward,
          latitude: point.lat,
          longitude: point.lng,
        }));
        setLocationsTouched(false);
        seed({
          province: result.province ?? undefined,
          district: result.district ?? undefined,
          ward: result.ward ?? undefined,
        });
      })
      .catch(() => {
        setLocateError('Could not resolve this location to an address.');
      })
      .finally(() => setLocating(false));
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocateError('This browser cannot share a location.');
      return;
    }

    setLocateError(null);
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyLocationPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setLocateError('Location permission was denied. Fill the fields manually instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function startAdd() {
    resetForm();
    setForm({
      ...emptyForm,
      isDefault: addresses.length === 0,
      receiverName: profile?.fullName ?? '',
      phone: profile?.phone ?? '',
    });
    setShowForm(true);
  }

  async function persistAddresses(nextAddresses: AddressUpsert[]) {
    if (!profile) return;

    // Profile phone is required by the update API, but address phone is what
    // the buyer edits here. Keep an existing profile phone; if missing, backfill
    // from the address list so they are not forced to Account information first.
    const existingPhone = profile.phone?.trim() ?? '';
    const fallbackPhone =
      nextAddresses.find((a) => a.isDefault)?.phone?.trim() ||
      nextAddresses[0]?.phone?.trim() ||
      '';
    const phone = validateVnPhone(existingPhone || fallbackPhone, 'Phone number');

    await updateProfile({
      fullName: profile.fullName,
      phone,
      avatarUrl: profile.avatarUrl ?? null,
      addresses: nextAddresses,
    });
  }

  function toUpsert(a: Address): AddressUpsert {
    return {
      addressId: a.addressId,
      receiverName: a.receiverName,
      phone: a.phone,
      province: a.province,
      district: a.district,
      ward: a.ward,
      streetAddress: a.streetAddress,
      latitude: a.latitude ?? null,
      longitude: a.longitude ?? null,
      isDefault: a.isDefault,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setFormSuccess(null);

    try {
      const normalized: AddressUpsert = {
        ...form,
        receiverName: validateRequired(form.receiverName, 'Recipient'),
        phone: validateVnPhone(form.phone, 'Phone number'),
        province: validateRequired(form.province, 'Province / City'),
        district: validateRequired(form.district, 'District'),
        ward: validateRequired(form.ward, 'Ward'),
        streetAddress: validateRequired(form.streetAddress, 'Street address'),
        // Keep any previously saved pin; this form no longer edits coordinates.
        latitude: form.latitude ?? null,
        longitude: form.longitude ?? null,
      };
      const base = addresses.map(toUpsert);

      let next: AddressUpsert[];

      if (editingId) {
        next = base.map((a) =>
          a.addressId === editingId ? { ...normalized, addressId: editingId } : a,
        );
      } else {
        if (base.length >= MAX_ADDRESSES) {
          showAlert(`Maximum of ${MAX_ADDRESSES} addresses.`);
          return;
        }
        next = [...base, { ...normalized, addressId: undefined }];
      }

      if (normalized.isDefault) {
        const markId = editingId;
        next = next.map((a, index) => ({
          ...a,
          isDefault: markId ? a.addressId === markId : index === next.length - 1,
        }));
      }

      await persistAddresses(next);
      setFormSuccess(editingId ? 'Address updated.' : 'Address added.');
      resetForm();
    } catch (err) {
      showAlert(getErrorMessage(err));
    }
  }

  function requestDelete(address: Address) {
    if (!profile) return;
    setDialog({
      kind: 'confirm-delete',
      addressId: address.addressId,
      label: formatAddressLine(address),
    });
  }

  async function confirmDelete() {
    if (!profile || dialog?.kind !== 'confirm-delete') return;

    const addressId = dialog.addressId;
    setFormSuccess(null);

    try {
      const next = addresses.filter((a) => a.addressId !== addressId).map(toUpsert);

      await persistAddresses(next);
      setDialog(null);
      setFormSuccess('Address deleted.');
      if (editingId === addressId) resetForm();
    } catch (err) {
      showAlert(
        getErrorMessage(err),
        'Unable to delete address',
      );
    }
  }

  async function handleSetDefault(addressId: string) {
    if (!profile) return;

    setFormSuccess(null);

    try {
      const next = addresses.map<AddressUpsert>((a) => ({
        ...toUpsert(a),
        isDefault: a.addressId === addressId,
      }));

      await persistAddresses(next);
      setFormSuccess('Default address updated.');
    } catch (err) {
      showAlert(getErrorMessage(err));
    }
  }

  if (loading && !profile) {
    return (
      <div className="account-address-content-box">
        <p className="account-muted">Loading addresses…</p>
      </div>
    );
  }

  return (
    <div className="account-page account-address-content-box">
      <div className="account-toolbar">
        <p className="account-toolbar__lead">
          These addresses will be used by default at checkout. Maximum of {MAX_ADDRESSES}{' '}
          addresses - {sortedAddresses.length} saved.
        </p>
        {canAddMore && (
          <button
            type="button"
            className="account-btn account-btn--primary"
            onClick={startAdd}
            disabled={saving}
          >
            <i className="fa-solid fa-plus" aria-hidden />
            Add address
          </button>
        )}
      </div>

      {sortedAddresses.length === 0 ? (
        <div className="account-empty">
          <p>No addresses yet. Add one so checkout can deliver your orders.</p>
          <button
            type="button"
            className="account-btn account-btn--primary"
            onClick={startAdd}
            disabled={saving}
          >
            Add address
          </button>
        </div>
      ) : (
        <div className="address-grid">
          {sortedAddresses.map((address) => (
            <article
              key={address.addressId}
              className={`address-card${address.isDefault ? ' address-card--default' : ''}${
                editingId === address.addressId ? ' address-card--editing' : ''
              }`}
            >
              <div className="address-card__head">
                <p className="address-card__name">
                  {address.receiverName}
                  {address.isDefault && <span className="address-card__badge">Default</span>}
                </p>
                <button
                  type="button"
                  className="account-btn account-btn--ghost account-btn--sm"
                  onClick={() => setEditingId(address.addressId)}
                  disabled={saving}
                >
                  <i className="fa-solid fa-pen-to-square" aria-hidden />
                  Edit
                </button>
              </div>

              <p className="address-card__row">
                <i className="fa-solid fa-location-dot" aria-hidden />
                <span>{formatAddressLine(address)}</span>
              </p>
              <p className="address-card__row">
                <i className="fa-solid fa-phone" aria-hidden />
                <span>{address.phone}</span>
              </p>

              <div className="address-card__actions">
                {!address.isDefault && (
                  <button
                    type="button"
                    className="account-btn account-btn--secondary account-btn--sm"
                    onClick={() => handleSetDefault(address.addressId)}
                    disabled={saving}
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  className="account-btn account-btn--danger account-btn--sm"
                  onClick={() => requestDelete(address)}
                  disabled={saving}
                >
                  <i className="fa-regular fa-trash-can" aria-hidden />
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <section className="address-form-panel">
          <header className="address-form-panel__head">
            <div>
              <h2 className="address-form-panel__title">
                {editingId ? 'Edit address' : 'Add new address'}
              </h2>
              <p className="address-form-panel__sub">
                Province, district and ward come from the courier's own list, so your
                parcel is never rejected for an address it cannot read.
              </p>
            </div>
            <button
              type="button"
              className="account-btn account-btn--ghost account-btn--sm"
              onClick={resetForm}
              disabled={saving}
              aria-label="Close address form"
            >
              <i className="fa-solid fa-xmark" aria-hidden />
              Close
            </button>
          </header>

          <form className="address-form" onSubmit={handleSubmit} noValidate>
            <div className="address-form__locate">
              <p className="address-form__locate-hint">
                Optionally fill province, district, ward and street from your current GPS
                position. You can still edit every field afterwards.
              </p>
              <button
                type="button"
                className="account-btn account-btn--secondary account-btn--sm"
                onClick={handleUseMyLocation}
                disabled={locating || saving}
              >
                <i className="fa-solid fa-location-crosshairs" aria-hidden />
                {locating ? 'Locating…' : 'Use my location'}
              </button>
            </div>
            {locateError ? <p className="address-form__locate-error">{locateError}</p> : null}

            <div className="address-form__fields">
              <div className="address-form__row">
                <div className="address-field">
                  <label htmlFor="receiverName">Recipient *</label>
                  <input
                    id="receiverName"
                    type="text"
                    className="form-control"
                    value={form.receiverName}
                    onChange={(e) => setForm((f) => ({ ...f, receiverName: e.target.value }))}
                    required
                  />
                </div>

                <div className="address-field">
                  <label htmlFor="addrPhone">Phone number *</label>
                  <input
                    id="addrPhone"
                    type="tel"
                    className="form-control"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="address-form__row">
                <div className="address-field">
                  <label htmlFor="province">Province / City *</label>
                  <select
                    id="province"
                    className="form-select"
                    value={provinceId}
                    disabled={locations.loadingProvinces}
                    onChange={(e) => {
                      setLocationsTouched(true);
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
                  {!provinceId && form.province ? (
                    <p className="address-field__hint">Saved as “{form.province}”</p>
                  ) : null}
                </div>

                <div className="address-field">
                  <label htmlFor="district">District *</label>
                  <select
                    id="district"
                    className="form-select"
                    value={districtId}
                    disabled={!provinceId || locations.loadingDistricts}
                    onChange={(e) => {
                      setLocationsTouched(true);
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
                  {!districtId && form.district ? (
                    <p className="address-field__hint">Saved as “{form.district}”</p>
                  ) : null}
                </div>
              </div>

              <div className="address-form__row">
                <div className="address-field">
                  <label htmlFor="ward">Ward *</label>
                  <select
                    id="ward"
                    className="form-select"
                    value={wardId}
                    disabled={!districtId || locations.loadingWards}
                    onChange={(e) => {
                      setLocationsTouched(true);
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
                  {!wardId && form.ward ? (
                    <p className="address-field__hint">Saved as “{form.ward}”</p>
                  ) : null}
                </div>

                <div className="address-field">
                  <label htmlFor="streetAddress">Street address *</label>
                  <input
                    id="streetAddress"
                    type="text"
                    className="form-control"
                    placeholder="House number, street name"
                    value={form.streetAddress}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, streetAddress: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <label className="address-toggle">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                <span className="address-toggle__text">
                  <span className="address-toggle__title">Set as default address</span>
                  <span className="address-toggle__sub">
                    Checkout will pick this one first.
                  </span>
                </span>
              </label>
            </div>

            <div className="address-form__actions">
              <button type="submit" className="account-btn account-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save address'}
              </button>
              <button
                type="button"
                className="account-btn account-btn--secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <AccountConfirmModal
        open={dialog?.kind === 'confirm-delete'}
        title="Delete this address?"
        confirmLabel="Delete"
        confirmVariant="danger"
        confirming={saving}
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={() => {
          if (!saving) setDialog(null);
        }}
      >
        <p>
          This permanently removes “
          {dialog?.kind === 'confirm-delete' ? dialog.label : 'this address'}” from your
          account. If it is linked to an existing order, deletion will be blocked.
        </p>
      </AccountConfirmModal>

      <AccountConfirmModal
        open={dialog?.kind === 'alert'}
        title={dialog?.kind === 'alert' ? dialog.title : 'Notice'}
        showConfirm={false}
        cancelLabel="OK"
        onCancel={() => setDialog(null)}
      >
        <p>{dialog?.kind === 'alert' ? dialog.message : null}</p>
      </AccountConfirmModal>
    </div>
  );
}
