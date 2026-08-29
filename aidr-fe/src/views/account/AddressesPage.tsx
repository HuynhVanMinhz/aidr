import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useProfile } from '../../hooks/useProfile';
import { useToastMessage } from '../../hooks/useToastMessage';
import type { Address, AddressUpsert } from '../../types/profile';
import { validateRequired, validateVnPhone } from '../../utils/validators';

const MAX_ADDRESSES = 10;

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
  const { profile, loading, saving, error, updateProfile, getErrorMessage } = useProfile();
  const [form, setForm] = useState<AddressUpsert>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useToastMessage(error);
  useToastMessage(formError);
  useToastMessage(formSuccess, 'success');

  const addresses = profile?.addresses ?? [];
  const canAddMore = addresses.length < MAX_ADDRESSES;

  const sortedAddresses = useMemo(
    () => [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [addresses],
  );

  useEffect(() => {
    if (editingId) {
      const current = addresses.find((a) => a.addressId === editingId);
      if (current) {
        setForm({
          addressId: current.addressId,
          receiverName: current.receiverName,
          phone: current.phone,
          province: current.province,
          district: current.district,
          ward: current.ward,
          streetAddress: current.streetAddress,
          isDefault: current.isDefault,
        });
        setShowForm(true);
      }
    }
  }, [addresses, editingId]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setFormError(null);
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
    const phone = validateVnPhone(profile.phone, 'Profile phone number');
    await updateProfile({
      fullName: profile.fullName,
      phone,
      avatarUrl: profile.avatarUrl ?? null,
      addresses: nextAddresses,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setFormError(null);
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
      };
      const base = addresses.map<AddressUpsert>((a) => ({
        addressId: a.addressId,
        receiverName: a.receiverName,
        phone: a.phone,
        province: a.province,
        district: a.district,
        ward: a.ward,
        streetAddress: a.streetAddress,
        isDefault: a.isDefault,
      }));

      let next: AddressUpsert[];

      if (editingId) {
        next = base.map((a) =>
          a.addressId === editingId ? { ...normalized, addressId: editingId } : a,
        );
      } else {
        if (base.length >= MAX_ADDRESSES) {
          setFormError(`Maximum of ${MAX_ADDRESSES} addresses.`);
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
      setFormError(getErrorMessage(err));
    }
  }

  async function handleDelete(addressId: string) {
    if (!profile || !window.confirm('Delete this address?')) return;

    setFormError(null);
    setFormSuccess(null);

    try {
      const next = addresses
        .filter((a) => a.addressId !== addressId)
        .map<AddressUpsert>((a) => ({
          addressId: a.addressId,
          receiverName: a.receiverName,
          phone: a.phone,
          province: a.province,
          district: a.district,
          ward: a.ward,
          streetAddress: a.streetAddress,
          isDefault: a.isDefault,
        }));

      await persistAddresses(next);
      setFormSuccess('Address deleted.');
      if (editingId === addressId) resetForm();
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  }

  async function handleSetDefault(addressId: string) {
    if (!profile) return;

    setFormError(null);
    setFormSuccess(null);

    try {
      const next = addresses.map<AddressUpsert>((a) => ({
        addressId: a.addressId,
        receiverName: a.receiverName,
        phone: a.phone,
        province: a.province,
        district: a.district,
        ward: a.ward,
        streetAddress: a.streetAddress,
        isDefault: a.addressId === addressId,
      }));

      await persistAddresses(next);
      setFormSuccess('Default address updated.');
    } catch (err) {
      setFormError(getErrorMessage(err));
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
    <div className="account-address-content-box">

      <div className="account-address-content-header">
        <p>
          These addresses will be used by default at checkout. Maximum of {MAX_ADDRESSES} addresses.
        </p>
        {canAddMore && (
          <button type="button" className="btn-default btn-accent" onClick={startAdd} disabled={saving}>
            Add address
          </button>
        )}
      </div>


      <div className="account-address-item-list">
        {sortedAddresses.length === 0 ? (
          <p className="account-muted">No addresses yet.</p>
        ) : (
          sortedAddresses.map((address) => (
            <div key={address.addressId} className="account-address-item">
              <div className="account-address-item-title">
                <h2>
                  {address.isDefault ? 'Default address' : 'Shipping address'}
                  {address.isDefault && <span className="account-badge">Default</span>}
                </h2>
                <p>
                  <button
                    type="button"
                    className="account-link-btn"
                    onClick={() => setEditingId(address.addressId)}
                    disabled={saving}
                  >
                    Edit <img src="/theme/images/icon-pen.svg" alt="" />
                  </button>
                </p>
              </div>
              <div className="account-address-item-info-list">
                <ul>
                  <li>{address.receiverName} · {address.phone}</li>
                  <li>{formatAddressLine(address)}</li>
                </ul>
              </div>
              <div className="account-address-actions">
                {!address.isDefault && (
                  <button
                    type="button"
                    className="btn-default btn-border"
                    onClick={() => handleSetDefault(address.addressId)}
                    disabled={saving}
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  className="btn-default btn-border account-btn-danger"
                  onClick={() => handleDelete(address.addressId)}
                  disabled={saving}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="account-addresses-content-box account-form-panel">
          <div className="checkout-bill-address-title">
            <h2>{editingId ? 'Edit address' : 'Add new address'}</h2>
          </div>

          <form className="checkout-bill-address-form" onSubmit={handleSubmit}>
            <div className="row">
              <div className="form-group col-md-6">
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

              <div className="form-group col-md-6">
                <label htmlFor="addrPhone">Phone number *</label>
                <input
                  id="addrPhone"
                  type="text"
                  className="form-control"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="province">Province / City *</label>
                <input
                  id="province"
                  type="text"
                  className="form-control"
                  value={form.province}
                  onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="district">District *</label>
                <input
                  id="district"
                  type="text"
                  className="form-control"
                  value={form.district}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="ward">Ward *</label>
                <input
                  id="ward"
                  type="text"
                  className="form-control"
                  value={form.ward}
                  onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="streetAddress">Street address *</label>
                <input
                  id="streetAddress"
                  type="text"
                  className="form-control"
                  placeholder="House number, street name"
                  value={form.streetAddress}
                  onChange={(e) => setForm((f) => ({ ...f, streetAddress: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <div className="checkout-form-checkbox">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={form.isDefault}
                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  />
                  <label htmlFor="isDefault">Set as default address</label>
                </div>
              </div>

              <div className="form-group col-lg-12 account-form-actions">
                <button type="submit" className="btn-default btn-accent" disabled={saving}>
                  {saving ? 'Saving…' : 'Save address'}
                </button>
                <button type="button" className="btn-default btn-border" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
