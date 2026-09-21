import { Link } from 'react-router-dom';

export function TermsPage() {
  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Terms of Service</h1>
                <nav>
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <Link to="/">Home</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Terms
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
              <p className="text-muted">Last updated: August 2026</p>

              <h2>1. Acceptance</h2>
              <p>
                By accessing or using AIDR, you agree to these Terms of Service and our{' '}
                <Link to="/privacy">Privacy Policy</Link>. If you do not agree, please do not use the
                platform.
              </p>

              <h2>2. Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your login credentials
                and for all activity under your account. Notify us promptly of any unauthorized use.
              </p>

              <h2>3. Orders & payments</h2>
              <p>
                Product prices, availability, and shipping terms are set by sellers unless otherwise
                stated. Completed checkout creates a binding order subject to payment confirmation
                and seller fulfillment policies.
              </p>

              <h2>4. Returns & refunds</h2>
              <p>
                Return eligibility, evidence requirements, and refund processing follow platform
                rules and applicable seller policies. Submit return requests only for eligible
                orders within the stated window.
              </p>

              <h2>5. Seller obligations</h2>
              <p>
                Approved sellers must provide accurate listings, honor published policies, and
                comply with moderation and inventory requirements. AIDR may suspend shops that
                violate platform standards.
              </p>

              <h2>6. Limitation of liability</h2>
              <p>
                AIDR provides the marketplace platform on an &quot;as is&quot; basis. To the extent
                permitted by law, we are not liable for indirect or consequential damages arising
                from use of the service.
              </p>

              <p className="mb-0">
                Questions? See the <Link to="/help">Help Center</Link>,{' '}
                <Link to="/faq">FAQ</Link>, or <Link to="/privacy">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
