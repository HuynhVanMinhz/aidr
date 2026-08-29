import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useToastMessage } from '../../hooks/useToastMessage';
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
  useToastMessage(error);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or expired token.');
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
            <div className="page-state">
              <p className="page-state__title">Invalid reset link</p>
              <p className="page-state__text">
                This password reset link is missing or has expired.
              </p>
              <Link to="/forgot-password" className="btn-default btn-accent">
                Request a new link
              </Link>
            </div>
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
                        <h2>Password reset successful</h2>
                        <p>You can now sign in with your new password.</p>
                      </div>
                      <div className="login-content-form-btn login-now-btn">
                        <Link to="/login">Sign in now</Link>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      <div className="login-form-content">
                        <div className="login-content-title-box">
                          <h2>Reset password</h2>
                          <p>Enter a new password for your account.</p>
                        </div>


                        <div className="checkout-login-form">
                          <div className="form-group">
                            <label htmlFor="newPassword">New password *</label>
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
                            <label htmlFor="confirmPassword">Confirm password *</label>
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
                              {loading ? 'Updating…' : 'Update password'}
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
