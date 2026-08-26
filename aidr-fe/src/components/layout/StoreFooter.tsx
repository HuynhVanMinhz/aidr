import { Link } from 'react-router-dom';
import { useCategories } from '../../hooks/useCatalog';

export function StoreFooter() {
  const { categories } = useCategories();

  return (
    <footer className="main-footer dark-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="footer-benefit-item-list">
              <div className="footer-benefit-item">
                <div className="icon-box">
                  <img src="/theme/images/icon-footer-benefit-1.svg" alt="" />
                </div>
                <div className="footer-benefit-item-content">
                  <h2>Genuine Products!</h2>
                  <p>100% authentic electronics</p>
                </div>
              </div>
              <div className="footer-benefit-item">
                <div className="icon-box">
                  <img src="/theme/images/icon-footer-benefit-2.svg" alt="" />
                </div>
                <div className="footer-benefit-item-content">
                  <h2>Fast Delivery</h2>
                  <p>Quick and secure shipping</p>
                </div>
              </div>
              <div className="footer-benefit-item">
                <div className="icon-box">
                  <img src="/theme/images/icon-footer-benefit-3.svg" alt="" />
                </div>
                <div className="footer-benefit-item-content">
                  <h2>Secure Payments</h2>
                  <p>Safe online payment methods</p>
                </div>
              </div>
              <div className="footer-benefit-item">
                <div className="icon-box">
                  <img src="/theme/images/icon-footer-benefit-4.svg" alt="" />
                </div>
                <div className="footer-benefit-item-content">
                  <h2>Easy Returns</h2>
                  <p>Simple replacement process</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="about-footer">
              <div className="footer-logo">
                <img src="/theme/images/logo-white.svg" alt="AIDR" />
              </div>
              <div className="about-footer-content">
                <p>
                  AIDR — an AI-integrated electronics store with genuine devices and a transparent shopping experience.
                </p>
              </div>
              <div className="footer-social-links">
                <ul>
                  <li>
                    <a href="#social" aria-label="Facebook" onClick={(e) => e.preventDefault()}>
                      <i className="fa-brands fa-facebook-f" />
                    </a>
                  </li>
                  <li>
                    <a href="#social" aria-label="Instagram" onClick={(e) => e.preventDefault()}>
                      <i className="fa-brands fa-instagram" />
                    </a>
                  </li>
                  <li>
                    <a href="#social" aria-label="X" onClick={(e) => e.preventDefault()}>
                      <i className="fa-brands fa-x-twitter" />
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="col-xl-8">
            <div className="footer-links-box">
              <div className="footer-links">
                <h2>Quick Links</h2>
                <ul>
                  <li>
                    <Link to="/">Home</Link>
                  </li>
                  <li>
                    <Link to="/products">Shop</Link>
                  </li>
                  <li>
                    <Link to="/categories">Categories</Link>
                  </li>
                  <li>
                    <Link to="/help">Help</Link>
                  </li>
                  <li>
                    <Link to="/faq">FAQ</Link>
                  </li>
                  <li>
                    <Link to="/terms">Terms</Link>
                  </li>
                  <li>
                    <Link to="/login">Login</Link>
                  </li>
                </ul>
              </div>

              <div className="footer-links">
                <h2>Product Categories</h2>
                <ul>
                  {categories.slice(0, 5).map((cat) => (
                    <li key={cat.categoryId}>
                      <Link to={`/products?categoryId=${cat.categoryId}`}>{cat.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="footer-links footer-newsletter-form">
                <h2>Our Newsletter</h2>
                <p>Get offers, new products, and tech news.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div className="form-group">
                    <input type="email" name="mail" className="form-control" placeholder="Email" required />
                    <button type="submit" className="newsletter-btn" aria-label="Subscribe">
                      <i className="fa-regular fa-paper-plane" />
                    </button>
                  </div>
                </form>
                <p>Subscribe For Latest Tech Updates*</p>
              </div>
            </div>
          </div>

          <div className="col-lg-12">
            <div className="footer-copyright">
              <div className="footer-copyright-text">
                <p>Copyright © {new Date().getFullYear()} AIDR. All Rights Reserved.</p>
              </div>
              <div className="footer-payment-options">
                <ul>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <li key={n}>
                      <a href="#payment" onClick={(e) => e.preventDefault()}>
                        <img src={`/theme/images/icon-payment-option-${n}.svg`} alt="" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
