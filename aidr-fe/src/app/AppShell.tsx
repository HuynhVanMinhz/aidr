import { Link, Outlet } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

export function AppShell() {
  const { isAuthenticated, user, logout } = useAuth();

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
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        AIDR — Auth module (UC-01..05) · UI convert từ <code>theme-for-aidr-fe</code>
      </footer>
    </div>
  );
}
