import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

type Props = {
  isAuthenticated: boolean;
  isSeller: boolean;
  isAdmin: boolean;
};

export function StoreUserDropdown({ isAuthenticated, isSeller, isAdmin }: Props) {
  const { user, logout } = useAuth();
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
      <Link
        to="/login"
        className="store-header-icon-btn"
        aria-label="Login"
        title="Login"
      >
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
          </div>

          <div className="store-header-dropdown-body store-header-dropdown-body--menu">
            <Link to="/account/profile" onClick={() => setOpen(false)}>
              Account information
            </Link>
            <Link to="/account/orders" onClick={() => setOpen(false)}>
              Orders
            </Link>
            <Link to="/wishlist" onClick={() => setOpen(false)}>
              Wishlist
            </Link>
            <Link to="/account/notifications" onClick={() => setOpen(false)}>
              Notifications
            </Link>
            <Link to="/chat" onClick={() => setOpen(false)}>
              Messages
            </Link>
            {!isSeller ? (
              <Link to="/account/become-seller" onClick={() => setOpen(false)}>
                Become a seller
              </Link>
            ) : (
              <Link to="/seller" onClick={() => setOpen(false)}>
                Seller center
              </Link>
            )}
            {isAdmin ? (
              <Link to="/admin" onClick={() => setOpen(false)}>
                Admin
              </Link>
            ) : null}
          </div>

          <div className="store-header-dropdown-foot">
            <button type="button" className="store-header-dropdown-logout" onClick={() => void handleLogout()}>
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
