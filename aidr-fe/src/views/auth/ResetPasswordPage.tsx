import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import * as authApi from '../../services/authApi';
import { getApiErrorMessage } from '../../utils/apiError';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Token không hợp lệ hoặc đã hết hạn.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({
        token,
        newPassword,
        confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="page-forgot-password">
          <div className="container">
            <div className="auth-alert auth-alert--error" style={{ maxWidth: 520, margin: '2rem auto' }}>
              Link đặt lại mật khẩu không hợp lệ. Vui lòng yêu cầu link mới.
            </div>
            <p style={{ textAlign: 'center' }}>
              <Link to="/forgot-password">Yêu cầu link mới</Link>
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="page-forgot-password">
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              <div className="forgot-password-content-box">
                <div className="login-content-form-item" style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
                  {success ? (
                    <div className="login-form-content">
                      <div className="login-content-title-box">
                        <h2>Đặt lại mật khẩu thành công</h2>
                        <p>Bạn có thể đăng nhập bằng mật khẩu mới.</p>
                      </div>
                      <div className="login-content-form-btn login-now-btn">
                        <Link to="/login">Đăng nhập ngay</Link>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      <div className="login-form-content">
                        <div className="login-content-title-box">
                          <h2>Đặt lại mật khẩu</h2>
                          <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
                        </div>

                        {error && <div className="auth-alert auth-alert--error">{error}</div>}

                        <div className="checkout-login-form">
                          <div className="form-group">
                            <label htmlFor="newPassword">Mật khẩu mới *</label>
                            <input
                              id="newPassword"
                              type="password"
                              className="form-control"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              required
                              minLength={8}
                              autoComplete="new-password"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="confirmPassword">Xác nhận mật khẩu *</label>
                            <input
                              id="confirmPassword"
                              type="password"
                              className="form-control"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              required
                              minLength={8}
                              autoComplete="new-password"
                            />
                          </div>

                          <div className="checkout-login-btn reset-password-btn">
                            <button type="submit" className="btn-default btn-accent" disabled={loading}>
                              {loading ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
