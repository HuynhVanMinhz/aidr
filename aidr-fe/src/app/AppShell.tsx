import { Outlet, useLocation } from 'react-router-dom';
import { StoreFooter } from '../components/layout/StoreFooter';
import { StoreHeader } from '../components/layout/StoreHeader';

/** Catalog shell — theme topbar + header + footer (AIDR). */
export function AppShell() {
  const location = useLocation();
  const isAccount = location.pathname.startsWith('/account');

  return (
    <div className="store-shell">
      <StoreHeader />
      <main className={`store-main${isAccount ? ' store-main--account' : ''}`}>
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  );
}
