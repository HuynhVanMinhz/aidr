import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../hooks/useAuth';
import { useToastMessage } from '../../hooks/useToastMessage';

export function RegisterPage() {
  const { register, getErrorMessage } = useAuth();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useToastMessage(error);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password, returnUrl);
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout showBanner>
      <div className="page-login">
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              <div className="login-content-box">
                <div className="login-content-form-item" style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
                  <form onSubmit={handleSubmit}>
                    <div className="login-form-content">
                      <div className="login-content-title-box">
                        <h2>Create an account</h2>
                        <p>Create a Buyer account to start shopping on AIDR.</p>
                      </div>


                      <div className="checkout-login-form">
                        <div className="form-group">
                          <label htmlFor="fullName">Full name *</label>
                          <input
                            id="fullName"
                            type="text"
                            className="form-control"
                            placeholder="Jane Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            autoComplete="name"
                          />
                        </div>

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

                        <div className="form-group">
                          <label htmlFor="password">Password *</label>
                          <input
                            id="password"
                            type="password"
                            className="form-control"
                            placeholder="At least 8 characters, uppercase & special character"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            autoComplete="new-password"
                          />
                        </div>

                        <div className="login-form-info">
                          <p>
                            Password must be at least 8 characters and include an uppercase letter and a
                            special character. Personal data is used according to AIDR&apos;s{' '}
                            <Link to="/privacy">privacy policy</Link>.
                          </p>
                        </div>

                        <div className="checkout-login-btn signup-form-btn">
                          <button type="submit" className="btn-default btn-accent" disabled={loading}>
                            {loading ? 'Creating account…' : 'Sign up'}
                          </button>
                        </div>

                        <div className="login-content-form-btn login-now-btn">
                          <Link to={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}>
                            Already have an account? Sign in
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
