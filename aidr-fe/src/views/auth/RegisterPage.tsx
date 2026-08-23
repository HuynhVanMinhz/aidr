import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../hooks/useAuth';

export function RegisterPage() {
  const { register, getErrorMessage } = useAuth();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password, returnUrl);
    } catch (err) {
      setError(getErrorMessage(err, 'Đăng ký thất bại.'));
    } finally {
      setLoading(false);
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
                        <h2>Đăng ký tài khoản</h2>
                        <p>Tạo tài khoản Buyer để bắt đầu mua sắm trên AIDR.</p>
                      </div>

                      {error && <div className="auth-alert auth-alert--error">{error}</div>}

                      <div className="checkout-login-form">
                        <div className="form-group">
                          <label htmlFor="fullName">Họ và tên *</label>
                          <input
                            id="fullName"
                            type="text"
                            className="form-control"
                            placeholder="Nguyễn Văn A"
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
                          <label htmlFor="password">Mật khẩu *</label>
                          <input
                            id="password"
                            type="password"
                            className="form-control"
                            placeholder="Tối thiểu 8 ký tự, có chữ hoa & ký tự đặc biệt"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            autoComplete="new-password"
                          />
                        </div>

                        <div className="login-form-info">
                          <p>
                            Mật khẩu cần ≥ 8 ký tự, có chữ hoa và ký tự đặc biệt. Dữ liệu cá nhân được dùng
                            theo chính sách bảo mật của AIDR.
                          </p>
                        </div>

                        <div className="checkout-login-btn signup-form-btn">
                          <button type="submit" className="btn-default btn-accent" disabled={loading}>
                            {loading ? 'Đang đăng ký…' : 'Đăng ký'}
                          </button>
                        </div>

                        <div className="login-content-form-btn login-now-btn">
                          <Link to={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}>
                            Đã có tài khoản? Đăng nhập
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
