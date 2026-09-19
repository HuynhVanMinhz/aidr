import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../ThemeToggle';
import { StoreNotificationDropdown } from './StoreNotificationDropdown';
import { StoreUserDropdown } from './StoreUserDropdown';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useAuth } from '../../hooks/useAuth';
import { useRoles } from '../../hooks/useRoles';
import { useCart } from '../../hooks/useCart';
import { useCategories } from '../../hooks/useCatalog';
import { useWishlistMembership } from '../../hooks/useWishlist';
import * as voucherApi from '../../services/voucherApi';
import type { CategoryTreeNode } from '../../types/catalog';
import { formatMoney } from '../../utils/formatCatalog';

const DEFAULT_TOPBAR =
  'Shop genuine electronics - secure checkout and fast delivery';

function flattenCategories(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenCategories(node.children));
  }
  return result;
}

function formatVoucherPromo(item: {
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
}): string {
  const discount =
    item.discountType.toLowerCase() === 'percent'
      ? `${item.discountValue}% off`
      : `${formatMoney(item.discountValue)} off`;
  return `${item.name}: ${discount} with code ${item.code}`;
}

export function StoreHeader() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { canBecomeSeller, workspaces } = useRoles();
  const { totalQuantity } = useCart({ autoLoad: isAuthenticated });
  const { totalCount: wishlistCount } = useWishlistMembership({ autoLoad: isAuthenticated });
  const { categories } = useCategories();
  const [q, setQ] = useState('');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [topbarText, setTopbarText] = useState(DEFAULT_TOPBAR);
  const cartTo = isAuthenticated ? '/cart' : `/login?returnUrl=${encodeURIComponent('/cart')}`;
  const wishlistTo = isAuthenticated
    ? '/wishlist'
    : `/login?returnUrl=${encodeURIComponent('/wishlist')}`;

  useEffect(() => {
    if (!isAuthenticated) {
      setTopbarText(DEFAULT_TOPBAR);
      return;
    }

    let cancelled = false;
    void voucherApi
      .listVouchers({ scope: 'System', page: 1, pageSize: 5 })
      .then((res) => {
        if (cancelled || !res.success || !res.data?.items?.length) {
          if (!cancelled) setTopbarText(DEFAULT_TOPBAR);
          return;
        }
        const best = res.data.items.find((v) => v.isEligible) ?? res.data.items[0];
        setTopbarText(formatVoucherPromo(best));
      })
      .catch(() => {
        if (!cancelled) setTopbarText(DEFAULT_TOPBAR);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/products?q=${encodeURIComponent(term)}` : '/products');
  }

  const flatCategories = flattenCategories(categories);

  return (
    <>
      <div className="topbar">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-12">
              <div className="topbar-content-box">
                <div className="topbar-content-info">
                  <p>{topbarText}</p>
                </div>
                <div className="topbar-menu">
                  <ul>
                    <li>
                      <Link to="/products">Shop</Link>
                    </li>
                    <li>
                      <Link to="/categories">Categories</Link>
                    </li>
                    <li>
                      <Link to="/help">Support</Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <header className="main-header">
        <div className="header-sticky">
          <nav className="navbar navbar-expand-lg">
            <div className="header-action-box">
              <Link className="navbar-brand" to="/">
                <img src="/theme/images/aidr-logo-header.png" alt="AIDR" />
              </Link>

              <div className="header-search-form-box">
                <form className="header-search-form" onSubmit={handleSearch}>
                  <div className="form-group">
                    <input
                      type="text"
                      name="product"
                      className="form-control"
                      placeholder="Search By Products..."
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                    <button type="submit" className="header-search-btn" aria-label="Search">
                      <i className="fa-solid fa-magnifying-glass" />
                    </button>
                  </div>
                </form>
              </div>

              <div className="header-action-details mobile-hide">
                <ul>
                  <li className="store-header-theme-item">
                    <ThemeToggle iconOnly />
                  </li>
                  <li>
                    <StoreNotificationDropdown isAuthenticated={isAuthenticated} />
                  </li>
                  <li>
                    <Link to={wishlistTo} className="store-header-icon-btn" aria-label="Wishlist">
                      <span className="store-header-icon-wrap">
                        <img src="/theme/images/icon-wishlist-primary.svg" alt="" />
                        {isAuthenticated && wishlistCount > 0 ? (
                          <span
                            className="store-header-badge"
                            aria-label={`${wishlistCount} items in wishlist`}
                          >
                            {wishlistCount > 99 ? '99+' : wishlistCount}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link to={cartTo} className="store-header-cart-link">
                      <span className="store-header-icon-wrap">
                        <img src="/theme/images/icon-cart-primary.svg" alt="" />
                        {isAuthenticated && totalQuantity > 0 ? (
                          <span
                            className="store-header-badge"
                            aria-label={`${totalQuantity} items in cart`}
                          >
                            {totalQuantity > 99 ? '99+' : totalQuantity}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                  {workspaces.length > 0 ? (
                    <li className="store-header-workspace-item">
                      <WorkspaceSwitcher workspaces={workspaces} />
                    </li>
                  ) : null}
                  <li>
                    <StoreUserDropdown isAuthenticated={isAuthenticated} />
                  </li>
                </ul>
              </div>
            </div>

            <div className="main-menu">
              <div className="collapse navbar-collapse show">
                <div
                  className={`popular-categories-box${categoriesOpen ? ' open' : ''}`}
                  onMouseEnter={() => setCategoriesOpen(true)}
                  onMouseLeave={() => setCategoriesOpen(false)}
                >
                  <button
                    type="button"
                    className="popular-categories-btn"
                    onClick={() => setCategoriesOpen((v) => !v)}
                  >
                    <img src="/theme/images/icon-popular-categories.svg" alt="" />
                    Popular Categories
                  </button>
                  <ul className="popular-categories-list">
                    {flatCategories.slice(0, 8).map((cat) => (
                      <li key={cat.categoryId}>
                        <Link
                          to={`/products?categoryId=${cat.categoryId}`}
                          onClick={() => setCategoriesOpen(false)}
                        >
                          {cat.name}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link to="/categories" onClick={() => setCategoriesOpen(false)}>
                        View all
                      </Link>
                    </li>
                  </ul>
                </div>

                <div className="nav-menu-wrapper">
                  <ul className="navbar-nav mr-auto" id="menu">
                    <li className="nav-item">
                      <Link className="nav-link" to="/">
                        Home
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/products">
                        Shop
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/categories">
                        Categories
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/about">
                        About Us
                      </Link>
                    </li>
                    {isAuthenticated ? (
                      <li className="nav-item">
                        <Link className="nav-link" to="/account/orders">
                          My Orders
                        </Link>
                      </li>
                    ) : (
                      <li className="nav-item">
                        <Link className="nav-link" to="/login">
                          Login / Register
                        </Link>
                      </li>
                    )}
                    {/* On desktop the workspaces live in the switcher beside the
                        account menu. That whole action row is hidden below lg,
                        so they come back into the nav there - otherwise a seller
                        on a phone has no way out of the storefront. */}
                    {workspaces.map((workspace) => (
                      <li className="nav-item nav-item--workspace" key={workspace.to}>
                        <Link className="nav-link nav-link--workspace" to={workspace.to}>
                          <i className={workspace.icon} aria-hidden />
                          {workspace.label}
                        </Link>
                      </li>
                    ))}
                    {canBecomeSeller ? (
                      <li className="nav-item">
                        <Link className="nav-link nav-link--cta" to="/account/become-seller">
                          Become a Seller
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
