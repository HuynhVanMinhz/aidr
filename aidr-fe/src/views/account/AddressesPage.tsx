import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useProfile } from '../../hooks/useProfile';
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
    const phone = validateVnPhone(profile.phone, 'Số điện thoại hồ sơ');
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
        receiverName: validateRequired(form.receiverName, 'Người nhận'),
        phone: validateVnPhone(form.phone, 'Số điện thoại'),
        province: validateRequired(form.province, 'Tỉnh / Thành phố'),
        district: validateRequired(form.district, 'Quận / Huyện'),
        ward: validateRequired(form.ward, 'Phường / Xã'),
        streetAddress: validateRequired(form.streetAddress, 'Địa chỉ chi tiết'),
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
          setFormError(`Tối đa ${MAX_ADDRESSES} địa chỉ.`);
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
      setFormSuccess(editingId ? 'Đã cập nhật địa chỉ.' : 'Đã thêm địa chỉ mới.');
      resetForm();
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  }

  async function handleDelete(addressId: string) {
    if (!profile || !window.confirm('Xóa địa chỉ này?')) return;

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
      setFormSuccess('Đã xóa địa chỉ.');
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
      setFormSuccess('Đã đặt địa chỉ mặc định.');
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  }

  if (loading && !profile) {
    return (
      <div className="account-address-content-box">
        <p className="account-muted">Đang tải địa chỉ…</p>
      </div>
    );
  }

  return (
    <div className="account-address-content-box">
      {error && !profile && <div className="auth-alert auth-alert--error">{error}</div>}

      <div className="account-address-content-header">
        <p>
          Địa chỉ dưới đây sẽ được dùng mặc định khi thanh toán. Tối đa {MAX_ADDRESSES} địa chỉ.
        </p>
        {canAddMore && (
          <button type="button" className="btn-default btn-accent" onClick={startAdd} disabled={saving}>
            Thêm địa chỉ
          </button>
        )}
      </div>

      {formError && <div className="auth-alert auth-alert--error">{formError}</div>}
      {formSuccess && <div className="auth-alert auth-alert--success">{formSuccess}</div>}

      <div className="account-address-item-list">
        {sortedAddresses.length === 0 ? (
          <p className="account-muted">Chưa có địa chỉ nào.</p>
        ) : (
          sortedAddresses.map((address) => (
            <div key={address.addressId} className="account-address-item">
              <div className="account-address-item-title">
                <h2>
                  {address.isDefault ? 'Địa chỉ mặc định' : 'Địa chỉ giao hàng'}
                  {address.isDefault && <span className="account-badge">Mặc định</span>}
                </h2>
                <p>
                  <button
                    type="button"
                    className="account-link-btn"
                    onClick={() => setEditingId(address.addressId)}
                    disabled={saving}
                  >
                    Sửa <img src="/theme/images/icon-pen.svg" alt="" />
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
                    Đặt mặc định
                  </button>
                )}
                <button
                  type="button"
                  className="btn-default btn-border account-btn-danger"
                  onClick={() => handleDelete(address.addressId)}
                  disabled={saving}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="account-addresses-content-box account-form-panel">
          <div className="checkout-bill-address-title">
            <h2>{editingId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}</h2>
          </div>

          <form className="checkout-bill-address-form" onSubmit={handleSubmit}>
            <div className="row">
              <div className="form-group col-md-6">
                <label htmlFor="receiverName">Người nhận *</label>
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
                <label htmlFor="addrPhone">Số điện thoại *</label>
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
                <label htmlFor="province">Tỉnh / Thành phố *</label>
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
                <label htmlFor="district">Quận / Huyện *</label>
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
                <label htmlFor="ward">Phường / Xã *</label>
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
                <label htmlFor="streetAddress">Địa chỉ chi tiết *</label>
                <input
                  id="streetAddress"
                  type="text"
                  className="form-control"
                  placeholder="Số nhà, tên đường"
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
                  <label htmlFor="isDefault">Đặt làm địa chỉ mặc định</label>
                </div>
              </div>

              <div className="form-group col-lg-12 account-form-actions">
                <button type="submit" className="btn-default btn-accent" disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Lưu địa chỉ'}
                </button>
                <button type="button" className="btn-default btn-border" onClick={resetForm} disabled={saving}>
                  Hủy
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
