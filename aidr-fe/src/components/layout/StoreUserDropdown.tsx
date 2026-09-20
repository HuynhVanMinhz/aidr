import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRoles } from '../../hooks/useRoles';

type Props = {
  isAuthenticated: boolean;
};

/** Shopping links only for accounts with the BUYER role. */
const SHOPPING_LINKS = [
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/returns', label: 'Returns' },
  { to: '/account/vouchers', label: 'Vouchers' },
  { to: '/account/wishlist', label: 'Wishlist' },
];

const ACCOUNT_LINKS = [
  { to: '/account/profile', label: 'Account information' },
  { to: '/account/notifications', label: 'Notifications' },
  { to: '/account/security', label: 'Security' },
];

export function StoreUserDropdown({ isAuthenticated }: Props) {
  const { user, logout } = useAuth();
  const { workspaces, canBecomeSeller, badges, isBuyer } = useRoles();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.store-header-dropdown--user')) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  if (!isAuthenticated) {
    return (
      <Link to="/login" className="store-header-icon-btn" aria-label="Login" title="Login">
        <span className="store-header-icon-wrap">
          <img src="/theme/images/icon-user-primary.svg" alt="" />
        </span>
      </Link>
    );
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate('/');
  }

  const displayName = user?.fullName?.trim() || user?.email || 'My Account';
  const close = () => setOpen(false);

  return (
    <div className={`store-header-dropdown store-header-dropdown--user${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="store-header-icon-btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="My Account"
        title="My Account"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="store-header-icon-wrap">
          <img src="/theme/images/icon-user-primary.svg" alt="" />
        </span>
      </button>

      {open ? (
        <div className="store-header-dropdown-panel" role="menu">
          <div className="store-header-dropdown-head store-header-dropdown-head--user">
            <strong>{displayName}</strong>
            {user?.email ? <span className="store-header-dropdown-email">{user.email}</span> : null}
            {/* Only elevated roles are shown - a "Buyer" badge tells nobody anything. */}
            {badges.length > 0 ? (
              <span className="store-header-role-badges">
                {badges.map((badge) => (
                  <span key={badge} className={`store-header-role-badge is-${badge.toLowerCase()}`}>
                    {badge}
                  </span>
                ))}
              </span>
            ) : null}
          </div>

          {workspaces.length > 0 ? (
            <div className="store-header-dropdown-body store-header-dropdown-body--menu">
              <span className="store-header-dropdown-group">Workspace</span>
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.to}
                  to={workspace.to}
                  className="store-header-dropdown-workspace"
                  onClick={close}
                >
                  <i className={workspace.icon} aria-hidden />
                  {workspace.label}
                </Link>
              ))}
            </div>
          ) : null}

          {isBuyer ? (
            <div className="store-header-dropdown-body store-header-dropdown-body--menu">
              <span className="store-header-dropdown-group">Shopping</span>
              {SHOPPING_LINKS.map((link) => (
                <Link key={link.to} to={link.to} onClick={close}>
                  {link.label}
                </Link>
              ))}
              <Link to="/chat" onClick={close}>
                Messages
              </Link>
            </div>
          ) : null}

          <div className="store-header-dropdown-body store-header-dropdown-body--menu">
            <span className="store-header-dropdown-group">Account</span>
            {ACCOUNT_LINKS.map((link) => (
              <Link key={link.to} to={link.to} onClick={close}>
                {link.label}
              </Link>
            ))}
            {canBecomeSeller ? (
              <Link to="/account/become-seller" className="store-header-dropdown-cta" onClick={close}>
                Become a seller
              </Link>
            ) : null}
          </div>

          <div className="store-header-dropdown-foot">
            <button
              type="button"
              className="store-header-dropdown-logout"
              onClick={() => void handleLogout()}
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
