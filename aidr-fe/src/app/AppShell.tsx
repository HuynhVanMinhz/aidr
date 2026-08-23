import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          AIDR
        </Link>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/health">API Health</Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        Foundation scaffold — UI screens sẽ convert từ <code>theme-for-aidr-fe</code>
      </footer>
    </div>
  );
}
