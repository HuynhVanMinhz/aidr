import { Link, Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

export function AppShell() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const isAccount = location.pathname.startsWith('/account');

  async function handleLogout() {
    await logout();
    window.location.assign('/');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          AIDR
        </Link>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/health">API Health</Link>
          {isAuthenticated && <Link to="/account/profile">Tài khoản</Link>}
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <span className="app-header__user">Xin chào, {user?.fullName ?? user?.email}</span>
              <button type="button" className="app-header__logout" onClick={handleLogout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Đăng nhập</Link>
              <Link to="/register">Đăng ký</Link>
            </>
          )}
        </nav>
      </header>
      <main className={`app-main${isAccount ? ' app-main--flush' : ''}`}>
        <Outlet />
      </main>
      <footer className="app-footer">
        AIDR — AI-Integrated Digital Retail
      </footer>
    </div>
  );
}
