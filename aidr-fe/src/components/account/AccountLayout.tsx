import { Link, Outlet, useLocation } from 'react-router-dom';
import { AccountSidebar } from './AccountSidebar';

const PAGE_META: Record<string, { title: string; breadcrumb: string }> = {
  '/account/profile': { title: 'Account information', breadcrumb: 'Account information' },
  '/account/addresses': { title: 'Shipping addresses', breadcrumb: 'Addresses' },
  '/account/change-password': { title: 'Password', breadcrumb: 'Password' },
};

export function AccountLayout() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? { title: 'Account', breadcrumb: 'Account' };

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

      <div className="page-account-details">
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
