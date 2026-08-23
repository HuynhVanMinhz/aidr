import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../hooks/useProfile';
import * as authApi from '../../services/authApi';

export function ChangePasswordPage() {
  const { profile, loading, changePassword, getErrorMessage } = useProfile();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [sendingSetLink, setSendingSetLink] = useState(false);
  const [setLinkError, setSetLinkError] = useState<string | null>(null);
  const [setLinkSuccess, setSetLinkSuccess] = useState<string | null>(null);

  const canSubmit =
    currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    setChangingPassword(true);

    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordSuccess('Đã đổi mật khẩu thành công.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSendSetPasswordLink() {
    if (!profile?.email) return;

    setSetLinkError(null);
    setSetLinkSuccess(null);
    setSendingSetLink(true);

    try {
      await authApi.forgotPassword({ email: profile.email });
      setSetLinkSuccess(
        'Nếu email hợp lệ, chúng tôi đã gửi link đặt mật khẩu. Kiểm tra hộp thư.',
      );
    } catch (err) {
      setSetLinkError(getErrorMessage(err));
    } finally {
      setSendingSetLink(false);
    }
  }

  if (loading && !profile) {
    return (
      <div className="account-details-content-box">
        <p className="account-muted">Đang tải…</p>
      </div>
    );
  }

  if (profile && !profile.hasPassword) {
    return (
      <div className="account-details-content-box">
        <div className="account-details-content-item">
          <div className="checkout-bill-address-title">
            <h2>Đặt mật khẩu</h2>
          </div>

          <p className="account-muted account-section-hint">
            Tài khoản này đăng nhập bằng Google và chưa có mật khẩu trên AIDR.
            Bạn không thể đổi mật khẩu cho đến khi đặt mật khẩu qua email.
          </p>

          {setLinkError && <div className="auth-alert auth-alert--error">{setLinkError}</div>}
          {setLinkSuccess && <div className="auth-alert auth-alert--success">{setLinkSuccess}</div>}

          <div className="checkout-login-btn account-form-actions">
            <button
              type="button"
              className="btn-default btn-accent"
              onClick={handleSendSetPasswordLink}
              disabled={sendingSetLink}
            >
              {sendingSetLink ? 'Đang gửi…' : 'Đặt mật khẩu qua email'}
            </button>
            <Link
              className="btn-default btn-border"
              to={`/forgot-password?email=${encodeURIComponent(profile.email)}`}
            >
              Mở trang quên mật khẩu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-details-content-box">
      <form className="checkout-bill-address-form" onSubmit={handlePasswordSubmit} noValidate>
        <div className="account-details-content-item">
          <div className="checkout-bill-address-title">
            <h2>Đổi mật khẩu</h2>
          </div>

          <p className="account-muted account-section-hint">
            Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự, có chữ hoa và ký tự đặc biệt).
          </p>

          {passwordError && <div className="auth-alert auth-alert--error">{passwordError}</div>}
          {passwordSuccess && <div className="auth-alert auth-alert--success">{passwordSuccess}</div>}

          <div className="checkout-bill-address-form">
            <div className="row">
              <div className="form-group col-lg-12">
                <label htmlFor="currentPassword">Mật khẩu hiện tại *</label>
                <input
                  id="currentPassword"
                  type="password"
                  className="form-control"
                  placeholder="Nhập mật khẩu hiện tại"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="newPassword">Mật khẩu mới *</label>
                <input
                  id="newPassword"
                  type="password"
                  className="form-control"
                  placeholder="Nhập mật khẩu mới"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="confirmPassword">Xác nhận mật khẩu mới *</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-control"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <div className="checkout-login-btn">
                  <button
                    type="submit"
                    className="btn-default btn-accent"
                    disabled={changingPassword || !canSubmit}
                  >
                    {changingPassword ? 'Đang đổi…' : 'Đổi mật khẩu'}
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
