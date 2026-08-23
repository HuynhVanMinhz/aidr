import { Link, Outlet, useLocation } from 'react-router-dom';
import { AccountSidebar } from './AccountSidebar';

const PAGE_META: Record<string, { title: string; breadcrumb: string }> = {
  '/account/profile': { title: 'Thông tin tài khoản', breadcrumb: 'Thông tin tài khoản' },
  '/account/addresses': { title: 'Địa chỉ giao hàng', breadcrumb: 'Địa chỉ' },
  '/account/change-password': { title: 'Mật khẩu', breadcrumb: 'Mật khẩu' },
};

export function AccountLayout() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? { title: 'Tài khoản', breadcrumb: 'Tài khoản' };

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
                      <Link to="/">Trang chủ</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="/account/profile">Tài khoản</Link>
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
