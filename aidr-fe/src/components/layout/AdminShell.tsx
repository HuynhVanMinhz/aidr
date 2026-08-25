import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IconifyIcon } from '../admin/IconifyIcon';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import '../../styles/admin.css';

export type AdminShellVariant = 'admin' | 'seller';

type AdminShellProps = {
  variant?: AdminShellVariant;
  children?: ReactNode;
};

function toggleAdminMenu() {
  const html = document.documentElement;
  const current = html.getAttribute('data-menu-size');
  if (window.innerWidth <= 1140) {
    html.setAttribute('data-menu-size', current === 'hidden' ? 'sm-hover-active' : 'hidden');
    return;
  }
  html.setAttribute('data-menu-size', current === 'condensed' ? 'sm-hover-active' : 'condensed');
}

function pageTitle(pathname: string, variant: AdminShellVariant) {
  if (pathname.includes('/categories/new')) return 'Create Category';
  if (pathname.includes('/categories/') && pathname.endsWith('/edit')) return 'Edit Category';
  if (pathname.includes('/categories')) return 'Categories List';
  if (pathname.match(/\/seller-registrations\/[^/]+$/)) return 'Seller Registration Review';
  if (pathname.includes('/seller-registrations')) return 'Seller Registrations';
  if (pathname.match(/\/orders\/[^/]+$/)) return 'Order Details';
  if (pathname.includes('/orders')) return 'Orders List';
  if (pathname.match(/\/products\/[^/]+\/inventory$/)) return 'Product Inventory';
  if (pathname.includes('/inventory')) return 'Inventory';
  if (pathname.includes('/products/new')) return 'Create Product';
  if (pathname.match(/\/products\/[^/]+\/edit$/)) return 'Edit Product';
  if (variant === 'admin' && pathname.match(/\/products\/[^/]+$/)) return 'Product Moderation';
  if (variant === 'admin' && pathname.includes('/products')) return 'Product Moderation';
  if (pathname.match(/\/products\/[^/]+$/)) return 'Product Details';
  if (pathname.includes('/products')) return 'Product List';
  return variant === 'seller' ? 'Welcome!' : 'Welcome!';
}

export function AdminShell({ variant = 'admin', children }: AdminShellProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [categoryOpen, setCategoryOpen] = useState(pathname.includes('/categories'));
  const [sellerRegOpen, setSellerRegOpen] = useState(pathname.includes('/seller-registrations'));
  const [productOpen, setProductOpen] = useState(pathname.includes('/products'));
  const [moderationOpen, setModerationOpen] = useState(
    variant === 'admin' && pathname.includes('/products'),
  );
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    if (pathname.includes('/categories')) setCategoryOpen(true);
    if (pathname.includes('/seller-registrations')) setSellerRegOpen(true);
    if (pathname.includes('/products')) {
      setProductOpen(true);
      if (variant === 'admin') setModerationOpen(true);
    }
  }, [pathname, variant]);

  const homePath = variant === 'seller' ? '/seller' : '/admin';
  const title = pageTitle(pathname, variant);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="wrapper">
      <header className="topbar">
        <div className="container-fluid">
          <div className="navbar-header">
            <div className="d-flex align-items-center">
              <div className="topbar-item">
                <button type="button" className="button-toggle-menu me-2" onClick={toggleAdminMenu}>
                  <IconifyIcon icon="solar:hamburger-menu-broken" className="fs-24 align-middle" />
                </button>
              </div>
              <div className="topbar-item">
                <h4 className="fw-bold topbar-button pe-none text-uppercase mb-0">{title}</h4>
              </div>
            </div>

            <div className="d-flex align-items-center gap-1">
              <div className="topbar-item">
                <button type="button" className="topbar-button" onClick={toggleTheme} id="light-dark-mode">
                  <IconifyIcon
                    icon={isDark ? 'solar:sun-bold-duotone' : 'solar:moon-bold-duotone'}
                    className="fs-24 align-middle"
                  />
                </button>
              </div>

              <div className={`dropdown topbar-item ${userOpen ? 'show' : ''}`}>
                <button
                  type="button"
                  className="topbar-button"
                  onClick={() => setUserOpen((v) => !v)}
                  aria-expanded={userOpen}
                >
                  <span className="d-flex align-items-center">
                    <span className="avatar-sm rounded-circle bg-primary text-white d-flex align-items-center justify-content-center">
                      {(user?.fullName ?? 'A').charAt(0).toUpperCase()}
                    </span>
                  </span>
                </button>
                <div className={`dropdown-menu dropdown-menu-end ${userOpen ? 'show' : ''}`}>
                  <h6 className="dropdown-header">Welcome {user?.fullName ?? ''}!</h6>
                  <Link className="dropdown-item" to="/" onClick={() => setUserOpen(false)}>
                    <i className="bx bx-store text-muted fs-18 align-middle me-1" />
                    <span className="align-middle">Storefront</span>
                  </Link>
                  <Link className="dropdown-item" to="/account/profile" onClick={() => setUserOpen(false)}>
                    <i className="bx bx-user-circle text-muted fs-18 align-middle me-1" />
                    <span className="align-middle">Profile</span>
                  </Link>
                  <div className="dropdown-divider" />
                  <button type="button" className="dropdown-item text-danger" onClick={() => void handleLogout()}>
                    <i className="bx bx-log-out fs-18 align-middle me-1" />
                    <span className="align-middle">Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="main-nav">
        <div className="logo-box">
          <Link to={homePath} className="logo-dark">
            <img src="/admin-theme/images/logo-sm.png" className="logo-sm" alt="logo sm" />
            <img src="/admin-theme/images/logo-dark.png" className="logo-lg" alt="logo dark" />
          </Link>
          <Link to={homePath} className="logo-light">
            <img src="/admin-theme/images/logo-sm.png" className="logo-sm" alt="logo sm" />
            <img src="/admin-theme/images/logo-light.png" className="logo-lg" alt="logo light" />
          </Link>
        </div>

        <button type="button" className="button-sm-hover" aria-label="Show Full Sidebar" onClick={toggleAdminMenu}>
          <IconifyIcon icon="solar:double-alt-arrow-right-bold-duotone" className="button-sm-hover-icon" />
        </button>

        <div className="scrollbar">
          <ul className="navbar-nav" id="navbar-nav">
            <li className="menu-title">General</li>
            <li className="nav-item">
              <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to={homePath} end>
                <span className="nav-icon">
                  <IconifyIcon icon="solar:widget-5-bold-duotone" />
                </span>
                <span className="nav-text">Dashboard</span>
              </NavLink>
            </li>

            {variant === 'admin' ? (
              <>
              <li className="nav-item">
                <a
                  className={`nav-link menu-arrow ${categoryOpen ? '' : 'collapsed'}`}
                  href="#sidebarCategory"
                  onClick={(e) => {
                    e.preventDefault();
                    setCategoryOpen((v) => !v);
                  }}
                >
                  <span className="nav-icon">
                    <IconifyIcon icon="solar:clipboard-list-bold-duotone" />
                  </span>
                  <span className="nav-text">Category</span>
                </a>
                <div className={`collapse ${categoryOpen ? 'show' : ''}`} id="sidebarCategory">
                  <ul className="nav sub-navbar-nav">
                    <li className="sub-nav-item">
                      <NavLink
                        className={({ isActive }) => `sub-nav-link${isActive ? ' active' : ''}`}
                        to="/admin/categories"
                        end
                      >
                        List
                      </NavLink>
                    </li>
                    <li className="sub-nav-item">
                      <NavLink
                        className={({ isActive }) => `sub-nav-link${isActive ? ' active' : ''}`}
                        to="/admin/categories/new"
                      >
                        Create
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link menu-arrow ${sellerRegOpen ? '' : 'collapsed'}`}
                  href="#sidebarSellerRegistrations"
                  onClick={(e) => {
                    e.preventDefault();
                    setSellerRegOpen((v) => !v);
                  }}
                >
                  <span className="nav-icon">
                    <IconifyIcon icon="solar:shop-bold-duotone" />
                  </span>
                  <span className="nav-text">Seller Onboarding</span>
                </a>
                <div className={`collapse ${sellerRegOpen ? 'show' : ''}`} id="sidebarSellerRegistrations">
                  <ul className="nav sub-navbar-nav">
                    <li className="sub-nav-item">
                      <NavLink
                        className={({ isActive }) => `sub-nav-link${isActive ? ' active' : ''}`}
                        to="/admin/seller-registrations"
                        end
                      >
                        Requests
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link menu-arrow ${moderationOpen ? '' : 'collapsed'}`}
                  href="#sidebarProductModeration"
                  onClick={(e) => {
                    e.preventDefault();
                    setModerationOpen((v) => !v);
                  }}
                >
                  <span className="nav-icon">
                    <IconifyIcon icon="solar:t-shirt-bold-duotone" />
                  </span>
                  <span className="nav-text">Product Moderation</span>
                </a>
                <div className={`collapse ${moderationOpen ? 'show' : ''}`} id="sidebarProductModeration">
                  <ul className="nav sub-navbar-nav">
                    <li className="sub-nav-item">
                      <NavLink
                        className={({ isActive }) => `sub-nav-link${isActive ? ' active' : ''}`}
                        to="/admin/products"
                        end
                      >
                        Queue
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
              </>
            ) : (
              <>
              <li className="nav-item">
                <a
                  className={`nav-link menu-arrow ${productOpen ? '' : 'collapsed'}`}
                  href="#sidebarSellerProducts"
                  onClick={(e) => {
                    e.preventDefault();
                    setProductOpen((v) => !v);
                  }}
                >
                  <span className="nav-icon">
                    <IconifyIcon icon="solar:t-shirt-bold-duotone" />
                  </span>
                  <span className="nav-text">Products</span>
                </a>
                <div className={`collapse ${productOpen ? 'show' : ''}`} id="sidebarSellerProducts">
                  <ul className="nav sub-navbar-nav">
                    <li className="sub-nav-item">
                      <NavLink
                        className={({ isActive }) => `sub-nav-link${isActive ? ' active' : ''}`}
                        to="/seller/products"
                        end
                      >
                        List
                      </NavLink>
                    </li>
                    <li className="sub-nav-item">
                      <NavLink
                        className={({ isActive }) => `sub-nav-link${isActive ? ' active' : ''}`}
                        to="/seller/products/new"
                      >
                        Create
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
              <li className="nav-item">
                <NavLink
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  to="/seller/inventory"
                  end
                >
                  <span className="nav-icon">
                    <IconifyIcon icon="solar:box-minimalistic-bold-duotone" />
                  </span>
                  <span className="nav-text">Inventory</span>
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  to="/seller/orders"
                >
                  <span className="nav-icon">
                    <IconifyIcon icon="solar:bag-check-bold-duotone" />
                  </span>
                  <span className="nav-text">Orders</span>
                </NavLink>
              </li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="page-content">
        <div className="container-xxl">{children ?? <Outlet />}</div>
        <footer className="footer">
          <div className="container-fluid">
            <div className="row">
              <div className="col-12 text-center">
                {new Date().getFullYear()} &copy; AIDR. AI-Integrated Digital Retail
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
