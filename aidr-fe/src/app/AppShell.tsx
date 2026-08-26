import { Outlet, useLocation } from 'react-router-dom';
import { CompareTray } from '../components/catalog/CompareTray';
import { StoreFooter } from '../components/layout/StoreFooter';
import { StoreHeader } from '../components/layout/StoreHeader';
import { useNotificationHub } from '../hooks/useNotificationHub';

/** Catalog shell — theme topbar + header + footer (AIDR). */
export function AppShell() {
  useNotificationHub();
  const location = useLocation();
  const isAccount = location.pathname.startsWith('/account');
  const hideCompareTray = location.pathname.startsWith('/compare');

  return (
    <div className="store-shell">
      <StoreHeader />
      <main className={`store-main${isAccount ? ' store-main--account' : ''}`}>
        <Outlet />
      </main>
      {!hideCompareTray && <CompareTray />}
      <StoreFooter />
    </div>
  );
}
