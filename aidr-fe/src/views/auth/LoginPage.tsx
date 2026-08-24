import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, startGoogleLogin, getErrorMessage } = useAuth();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume OAuth callback if interceptor redirected here with stale returnUrl
  useEffect(() => {
    if (returnUrl?.startsWith('/auth/callback')) {
      navigate(returnUrl, { replace: true });
    }
  }, [returnUrl, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password, returnUrl);
      if (remember) {
        // Session already persisted in localStorage via authSlice
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await startGoogleLogin();
    } catch (err) {
      setError(getErrorMessage(err));
      setGoogleLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="page-login">
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              <div className="login-content-box">
                <div className="login-content-form-item" style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
                  <form onSubmit={handleSubmit}>
                    <div className="login-form-content">
                      <div className="login-content-title-box">
                        <h2>Sign in</h2>
                        <p>Access your account to track orders and shop on AIDR.</p>
                      </div>

                      {error && <div className="auth-alert auth-alert--error">{error}</div>}

                      <div className="checkout-login-form">
                        <div className="form-group">
                          <label htmlFor="email">Email *</label>
                          <input
                            id="email"
                            type="email"
                            className="form-control"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="password">Password *</label>
                          <input
                            id="password"
                            type="password"
                            className="form-control"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                          />
                        </div>

                        <div className="checkout-login-form-footer">
                          <div className="checkout-login-btn">
                            <button type="submit" className="btn-default btn-accent" disabled={loading}>
                              {loading ? 'Signing in…' : 'Sign in'}
                            </button>
                          </div>
                          <div className="checkout-form-checkbox">
                            <input
                              type="checkbox"
                              id="remember"
                              checked={remember}
                              onChange={(e) => setRemember(e.target.checked)}
                            />
                            <label htmlFor="remember">Remember me</label>
                          </div>
                        </div>

                        <div className="login-content-form-btn">
                          <Link to="/forgot-password">Forgot password?</Link>
                        </div>

                        <div className="auth-divider">
                          <span>or</span>
                        </div>

                        <div className="checkout-login-btn">
                          <button
                            type="button"
                            className="btn-default btn-border auth-google-btn"
                            onClick={handleGoogle}
                            disabled={googleLoading || loading}
                          >
                            {googleLoading ? 'Redirecting to Google…' : 'Sign in with Google'}
                          </button>
                        </div>

                        <div className="login-content-form-btn login-now-btn">
                          <Link to={returnUrl ? `/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/register'}>
                            Don&apos;t have an account? Sign up
                          </Link>
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
