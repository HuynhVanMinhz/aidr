import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';

export function AccountSidebar() {
  const { logout } = useAuth();
  const { profile } = useProfile();
  const hasPassword = profile?.hasPassword ?? true;

  const navItems = [
    {
      to: '/account/profile',
      label: 'Thông tin tài khoản',
      icon: '/theme/images/icon-user-primary.svg',
    },
    {
      to: '/account/addresses',
      label: 'Địa chỉ giao hàng',
      icon: '/theme/images/icon-location-primary.svg',
    },
    {
      to: '/account/change-password',
      label: hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu',
      icon: '/theme/images/icon-security-primary.svg',
    },
  ] as const;

  async function handleLogout() {
    await logout();
    window.location.assign('/');
  }

  return (
    <div className="page-single-sidebar">
      <div className="my-account-sidebar-item">
        <ul>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <img src={item.icon} alt="" />
                {item.label}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" className="account-sidebar-logout" onClick={handleLogout}>
              <img src="/theme/images/icon-logout-primary.svg" alt="" />
              Đăng xuất
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
