import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import * as authApi from '../../services/authApi';
import { getApiErrorMessage } from '../../utils/apiError';

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get('email');
    if (fromQuery) setEmail(fromQuery);
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await authApi.forgotPassword({ email: email.trim() });
      setSuccess(
        result.message ||
          'If this email is registered, we have sent a password reset link (or check the API log in development).',
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="page-forgot-password">
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              <div className="forgot-password-content-box">
                <div className="login-content-form-item" style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
                  <form onSubmit={handleSubmit}>
                    <div className="login-form-content">
                      <div className="login-content-title-box">
                        <h2>Forgot password</h2>
                        <p>Enter your registered email. You will receive a one-time, time-limited reset link.</p>
                      </div>

                      {error && <div className="auth-alert auth-alert--error">{error}</div>}
                      {success && <div className="auth-alert auth-alert--success">{success}</div>}

                      <div className="checkout-login-form">
                        <div className="form-group">
                          <label htmlFor="email">Email *</label>
                          <input
                            id="email"
                            type="email"
                            className="form-control"
                            placeholder="email@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                          />
                        </div>

                        <div className="checkout-login-btn reset-password-btn">
                          <button type="submit" className="btn-default btn-accent" disabled={loading}>
                            {loading ? 'Sending…' : 'Send reset link'}
                          </button>
                        </div>

                        <div className="login-content-form-btn login-now-btn">
                          <Link to="/login">Back to sign in</Link>
                          {' · '}
                          <Link to="/account/change-password">Password settings</Link>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
