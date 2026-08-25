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
      label: 'Account information',
      icon: '/theme/images/icon-user-primary.svg',
    },
    {
      to: '/account/orders',
      label: 'Orders',
      icon: '/theme/images/icon-order-primary.svg',
    },
    {
      to: '/account/wishlist',
      label: 'Wishlist',
      icon: '/theme/images/icon-wishlist-primary.svg',
    },
    {
      to: '/account/following',
      label: 'Following',
      icon: '/theme/images/icon-dashboard-primary.svg',
    },
    {
      to: '/account/addresses',
      label: 'Shipping addresses',
      icon: '/theme/images/icon-location-primary.svg',
    },
    {
      to: '/account/change-password',
      label: hasPassword ? 'Change password' : 'Set password',
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
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
