import { useEffect } from 'react';
import { CompareTray } from '../components/catalog/CompareTray';
import { ShoppingAssistantWidget } from '../components/ai/ShoppingAssistantWidget';
import { StoreFooter } from '../components/layout/StoreFooter';
import { StoreHeader } from '../components/layout/StoreHeader';
import { useNotificationHub } from '../hooks/useNotificationHub';
import { Outlet, useLocation } from 'react-router-dom';

/** Catalog shell — theme topbar + header + footer (AIDR). */
export function AppShell() {
  useNotificationHub();
  const location = useLocation();
  const isAccount = location.pathname.startsWith('/account');
  const hideCompareTray = location.pathname.startsWith('/compare');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="store-shell">
      <StoreHeader />
      <main className={`store-main${isAccount ? ' store-main--account' : ''}`}>
        <Outlet />
      </main>
      {!hideCompareTray && <CompareTray />}
      <ShoppingAssistantWidget />
      <StoreFooter />
    </div>
  );
}
