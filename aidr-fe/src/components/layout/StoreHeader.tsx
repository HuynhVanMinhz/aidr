import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../ThemeToggle';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCatalog';
import type { CategoryTreeNode } from '../../types/catalog';

function flattenCategories(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenCategories(node.children));
  }
  return result;
}

export function StoreHeader() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { categories } = useCategories();
  const [q, setQ] = useState('');
  const [categoriesOpen, setCategoriesOpen] = useState(false);

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
                  <p>Get a Flat 10% Off on All Products — Limited Time Only</p>
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
                      <Link to="/login">Support</Link>
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
                <img src="/theme/images/logo.svg" alt="AIDR" />
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
                    <Link to="/login" aria-label="Wishlist">
                      <img src="/theme/images/icon-wishlist-primary.svg" alt="" />
                    </Link>
                  </li>
                  <li>
                    <Link to="/login">
                      <img src="/theme/images/icon-cart-primary.svg" alt="" />
                      My Cart
                    </Link>
                  </li>
                  {isAuthenticated ? (
                    <li>
                      <Link to="/account/profile" aria-label="My Account">
                        <img src="/theme/images/icon-user-primary.svg" alt="" />
                      </Link>
                    </li>
                  ) : null}
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
                        <Link to={`/products?categoryId=${cat.categoryId}`} onClick={() => setCategoriesOpen(false)}>
                          {cat.name}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link to="/categories" onClick={() => setCategoriesOpen(false)}>
                        Xem tất cả
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
                    {isAuthenticated ? (
                      <li className="nav-item">
                        <Link className="nav-link" to="/account/profile">
                          My Account
                        </Link>
                      </li>
                    ) : (
                      <li className="nav-item">
                        <Link className="nav-link" to="/login">
                          Login / Register
                        </Link>
                      </li>
                    )}
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
