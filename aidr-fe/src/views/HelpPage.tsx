import { Link } from 'react-router-dom';

export function HelpPage() {
  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Help Center</h1>
                <nav>
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <Link to="/">Home</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Help
                    </li>
                  </ol>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="light-section">
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <p>
                Welcome to the AIDR Help Center. Here you can find quick answers about shopping,
                orders, returns, and seller services on our platform.
              </p>

              <h2>Shopping & orders</h2>
              <p>
                Browse products, add items to your cart, and complete checkout with supported
                payment methods. Track order status from your account under{' '}
                <Link to="/account/orders">Orders</Link>.
              </p>

              <h2>Returns & refunds</h2>
              <p>
                Eligible orders can request a return from the order detail page. Upload required
                evidence and follow the status in{' '}
                <Link to="/account/returns">Returns</Link>.
              </p>

              <h2>Become a seller</h2>
              <p>
                Apply to open a shop from{' '}
                <Link to="/account/become-seller">Become a seller</Link>. Our team reviews
                applications and notifies you by email.
              </p>

              <h2>More resources</h2>
              <ul>
                <li>
                  <Link to="/faq">Frequently asked questions</Link>
                </li>
                <li>
                  <Link to="/terms">Terms of service</Link>
                </li>
              </ul>

              <p className="mb-0">
                Need account help? Visit{' '}
                <Link to="/account/security">Account security</Link> or sign in to contact support
                through order messaging.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
