import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useProfile } from '../../hooks/useProfile';
import {
  isCloudinaryConfigured,
  uploadAvatarToCloudinary,
  validateAvatarFile,
} from '../../utils/cloudinaryUpload';
import { validateRequired, validateVnPhone } from '../../utils/validators';

export function ProfilePage() {
  const { profile, loading, saving, error, updateProfile, getErrorMessage } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPublicId, setAvatarPublicId] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName);
    setPhone(profile.phone ?? '');
    setAvatarUrl(profile.avatarUrl ?? null);
    setAvatarPreview(profile.avatarUrl ?? null);
    setAvatarPublicId(null);
  }, [profile]);

  const isProfileDirty = useMemo(() => {
    if (!profile) return false;
    return (
      fullName.trim() !== profile.fullName ||
      phone.trim() !== (profile.phone ?? '') ||
      (avatarUrl ?? null) !== (profile.avatarUrl ?? null)
    );
  }, [profile, fullName, phone, avatarUrl]);

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormError(null);
    try {
      validateAvatarFile(file);
      if (!isCloudinaryConfigured()) {
        setFormError('Cloudinary chưa cấu hình — không thể upload avatar.');
        return;
      }

      setUploadingAvatar(true);
      const localPreview = URL.createObjectURL(file);
      setAvatarPreview(localPreview);

      const uploaded = await uploadAvatarToCloudinary(file);
      setAvatarUrl(uploaded.secureUrl);
      setAvatarPublicId(uploaded.publicId);
    } catch (err) {
      setFormError(getErrorMessage(err));
      setAvatarPreview(profile?.avatarUrl ?? null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isProfileDirty) return;

    setFormError(null);
    setFormSuccess(null);

    try {
      const name = validateRequired(fullName, 'Họ và tên');
      const phoneValue = validateVnPhone(phone, 'Số điện thoại');

      await updateProfile({
        fullName: name,
        phone: phoneValue,
        avatarUrl,
        avatarPublicId,
      });
      setFormSuccess('Đã cập nhật thông tin tài khoản.');
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  }

  if (loading && !profile) {
    return (
      <div className="account-details-content-box">
        <p className="account-muted">Đang tải hồ sơ…</p>
      </div>
    );
  }

  return (
    <div className="account-details-content-box">
      {error && !profile && <div className="auth-alert auth-alert--error">{error}</div>}

      <form className="checkout-bill-address-form" onSubmit={handleProfileSubmit} noValidate>
        <div className="account-details-content-item">
          <div className="checkout-bill-address-title">
            <h2>Thông tin cá nhân</h2>
          </div>

          {formError && <div className="auth-alert auth-alert--error">{formError}</div>}
          {formSuccess && <div className="auth-alert auth-alert--success">{formSuccess}</div>}

          <div className="account-avatar-row">
            <div className="account-avatar-preview">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" />
              ) : (
                <span>{fullName.charAt(0).toUpperCase() || '?'}</span>
              )}
            </div>
            <div className="account-avatar-actions">
              <p>Ảnh đại diện (tối đa 2MB)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="account-file-input"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar || saving}
              />
              <button
                type="button"
                className="btn-default btn-border"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || saving}
              >
                {uploadingAvatar ? 'Đang upload…' : 'Chọn ảnh'}
              </button>
            </div>
          </div>

          <div className="checkout-bill-address-form">
            <div className="row">
              <div className="form-group col-lg-12">
                <label htmlFor="fullName">Họ và tên *</label>
                <input
                  id="fullName"
                  type="text"
                  className="form-control"
                  placeholder="Nhập họ và tên"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={128}
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  value={profile?.email ?? ''}
                  readOnly
                  disabled
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="phone">Số điện thoại *</label>
                <input
                  id="phone"
                  type="tel"
                  className="form-control"
                  placeholder="Ví dụ: 0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <div className="checkout-login-btn">
                  <button
                    type="submit"
                    className="btn-default btn-accent"
                    disabled={saving || uploadingAvatar || !isProfileDirty}
                  >
                    {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
