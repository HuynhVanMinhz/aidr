import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { AccountSidebar } from './AccountSidebar';

const PAGE_META: Record<string, { title: string; breadcrumb: string }> = {
  '/account/profile': { title: 'Account information', breadcrumb: 'Account information' },
  '/account/addresses': { title: 'Shipping addresses', breadcrumb: 'Addresses' },
  '/account/change-password': { title: 'Password', breadcrumb: 'Password' },
  '/account/orders': { title: 'My orders', breadcrumb: 'Orders' },
  '/account/returns': { title: 'Return requests', breadcrumb: 'Returns' },
  '/account/vouchers': { title: 'Vouchers', breadcrumb: 'Vouchers' },
  '/account/become-seller': { title: 'Become a seller', breadcrumb: 'Become a seller' },
  '/account/security': { title: 'Account security', breadcrumb: 'Security' },
  '/account/notifications': { title: 'Notifications', breadcrumb: 'Notifications' },
  '/account/wishlist': { title: 'Wishlist', breadcrumb: 'Wishlist' },
  '/account/following': { title: 'Following', breadcrumb: 'Following' },
};

export function AccountLayout() {
  const location = useLocation();
  const { orderId, returnId } = useParams<{ orderId?: string; returnId?: string }>();

  const meta = (() => {
    if (orderId && location.pathname.startsWith('/account/orders/')) {
      return { title: 'Order details', breadcrumb: 'Order details' };
    }
    if (returnId && location.pathname.startsWith('/account/returns/')) {
      return { title: 'Return details', breadcrumb: 'Return details' };
    }
    return PAGE_META[location.pathname] ?? { title: 'Account', breadcrumb: 'Account' };
  })();

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>{meta.title}</h1>
                <nav>
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <Link to="/">Home</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="/account/profile">Account</Link>
                    </li>
                    {orderId ? (
                      <li className="breadcrumb-item">
                        <Link to="/account/orders">Orders</Link>
                      </li>
                    ) : null}
                    {returnId ? (
                      <li className="breadcrumb-item">
                        <Link to="/account/returns">Returns</Link>
                      </li>
                    ) : null}
                    <li className="breadcrumb-item active" aria-current="page">
                      {meta.breadcrumb}
                    </li>
                  </ol>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={
          location.pathname.startsWith('/account/orders') ||
            location.pathname.startsWith('/account/returns')
            ? 'page-account-order'
            : location.pathname.startsWith('/account/notifications')
              ? 'page-account-notifications'
              : location.pathname.startsWith('/account/wishlist')
                ? 'page-account-wishlist'
                : location.pathname.startsWith('/account/following')
                  ? 'page-account-following'
                  : 'page-account-details'
        }
      >
        <div className="container">
          <div className="row">
            <div className="col-lg-4">
              <AccountSidebar />
            </div>
            <div className="col-lg-8">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
