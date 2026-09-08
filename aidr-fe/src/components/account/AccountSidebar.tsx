import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';

type NavItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
};

function navLinkClass(isActive: boolean) {
  return `account-nav__link${isActive ? ' is-active' : ''}`;
}

export function AccountSidebar() {
  const { logout, roles } = useAuth();
  const { profile } = useProfile();
  const hasPassword = profile?.hasPassword ?? true;
  const isSeller = roles.some((role) => role.toUpperCase() === 'SELLER');

  const primaryItems: NavItem[] = [
    { to: '/account/profile', label: 'Account information', icon: 'fa-solid fa-user', end: true },
    { to: '/account/orders', label: 'Orders', icon: 'fa-solid fa-box' },
    { to: '/account/returns', label: 'Returns', icon: 'fa-solid fa-rotate-left' },
    { to: '/account/vouchers', label: 'Vouchers', icon: 'fa-solid fa-ticket', end: true },
    ...(!isSeller
      ? [
          {
            to: '/account/become-seller',
            label: 'Become a seller',
            icon: 'fa-solid fa-store',
            end: true,
          } satisfies NavItem,
        ]
      : []),
    { to: '/account/security', label: 'Security', icon: 'fa-solid fa-shield-halved', end: true },
    { to: '/account/notifications', label: 'Notifications', icon: 'fa-solid fa-bell', end: true },
    { to: '/chat', label: 'Messages', icon: 'fa-solid fa-comments', end: true },
  ];

  const secondaryItems: NavItem[] = [
    { to: '/account/wishlist', label: 'Wishlist', icon: 'fa-regular fa-heart', end: true },
    { to: '/account/following', label: 'Following', icon: 'fa-solid fa-user-plus', end: true },
    { to: '/account/following/feed', label: 'Shop feed', icon: 'fa-solid fa-rss', end: true },
    { to: '/account/addresses', label: 'Shipping addresses', icon: 'fa-solid fa-location-dot', end: true },
    {
      to: '/account/change-password',
      label: hasPassword ? 'Change password' : 'Set password',
      icon: 'fa-solid fa-key',
      end: true,
    },
  ];

  async function handleLogout() {
    await logout();
    window.location.assign('/');
  }

  function renderItem(item: NavItem) {
    return (
      <li key={item.to}>
        <NavLink
          to={item.to}
          end={item.end}
          className={({ isActive }) => navLinkClass(isActive)}
        >
          <i className={item.icon} aria-hidden />
          <span>{item.label}</span>
        </NavLink>
      </li>
    );
  }

  return (
    <nav className="account-nav account-card" aria-label="Account">
      <ul className="account-nav__list">{primaryItems.map(renderItem)}</ul>

      <div className="account-nav__divider" role="presentation" />

      <ul className="account-nav__list account-nav__list--secondary">
        {secondaryItems.map(renderItem)}
      </ul>

      <div className="account-nav__footer">
        <button
          type="button"
          className="account-nav__link account-nav__link--logout"
          onClick={() => void handleLogout()}
        >
          <i className="fa-solid fa-right-from-bracket" aria-hidden />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}
