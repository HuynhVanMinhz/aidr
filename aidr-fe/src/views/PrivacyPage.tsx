import { Link } from 'react-router-dom';

const SECTIONS = [
  { id: 'privacy_1', label: '1. Information we collect' },
  { id: 'identity-verification', label: '2. Identity verification (KYC)' },
  { id: 'privacy_2', label: '3. How we use information' },
  { id: 'privacy_3', label: '4. Cookies and tracking' },
  { id: 'privacy_4', label: '5. Sharing your information' },
  { id: 'privacy_5', label: '6. Data security' },
  { id: 'privacy_6', label: '7. Your rights' },
  { id: 'privacy_7', label: '8. Third-party links' },
  { id: 'privacy_8', label: '9. Changes to this policy' },
  { id: 'privacy_9', label: '10. Contact us' },
] as const;

export function PrivacyPage() {
  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Privacy Policy</h1>
                <nav>
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <Link to="/">Home</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Privacy Policy
                    </li>
                  </ol>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-privacy-policy">
        <div className="container">
          <div className="row">
            <div className="col-lg-4">
              <div className="page-single-sidebar">
                <div className="page-category-list privacy-policy-sidebar-list">
                  <ul>
                    {SECTIONS.map((section) => (
                      <li key={section.id}>
                        <a href={`#${section.id}`}>{section.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="sidebar-cta-box">
                  <h2 className="sidebar-cta-title">Need some help?</h2>
                  <ul>
                    <li>
                      <Link to="/help">
                        <img src="/theme/images/icon-mail-primary.svg" alt="" />
                        Help Center
                      </Link>
                    </li>
                    <li>
                      <Link to="/terms">
                        <img src="/theme/images/icon-phone-primary.svg" alt="" />
                        Terms of Service
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              <div className="privacy-policy-entry">
                <div className="privacy-policy-entry-header">
                  <h3>Effective date: 21 September 2026</h3>
                  <p>
                    Welcome to <Link to="/">AIDR</Link>. Your privacy is important to us, and we are
                    committed to protecting your personal information. This Privacy Policy explains
                    how we collect, use, and safeguard your data when you use our marketplace.
                  </p>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_1">
                  <div className="section-title">
                    <h2>1. Information we collect</h2>
                    <p>We may collect the following types of information:</p>
                  </div>

                  <div className="privacy-policy-entry-item-content">
                    <div className="privacy-policy-entry-item-content-box">
                      <h3>a. Personal information</h3>
                      <ul>
                        <li>Name</li>
                        <li>Email address</li>
                        <li>Phone number</li>
                        <li>Billing and shipping address</li>
                      </ul>
                    </div>

                    <div className="privacy-policy-entry-item-content-box">
                      <h3>b. Payment information</h3>
                      <p>
                        We do not store your full payment card details. Transactions are processed
                        securely through trusted payment gateways.
                      </p>
                    </div>

                    <div className="privacy-policy-entry-item-content-box">
                      <h3>c. Non-personal information</h3>
                      <ul>
                        <li>Browser type</li>
                        <li>IP address</li>
                        <li>Device information</li>
                        <li>Website usage data</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="identity-verification">
                  <div className="section-title">
                    <h2>2. Identity verification (KYC)</h2>
                    <p>
                      To sell on AIDR, applicants must verify their identity. For that check we
                      collect:
                    </p>
                  </div>

                  <div className="privacy-policy-entry-item-content">
                    <div className="privacy-policy-entry-item-content-box">
                      <ul>
                        <li>Photos of your government ID (front, and optionally back)</li>
                        <li>A portrait photo for face matching</li>
                        <li>
                          Data read from the ID (for example full name, date of birth, document type)
                        </li>
                      </ul>
                      <p>
                        We use this information only to verify identity, review seller applications,
                        detect duplicate or fraudulent accounts, and comply with applicable law. We
                        do not sell your KYC data to third parties.
                      </p>
                      <p>
                        ID images are uploaded to our storage provider (Cloudinary) and may be sent
                        to an identity-verification service to read the card and compare faces.
                        Platform staff may view submitted photos when an application needs manual
                        review or admin approval.
                      </p>
                      <p>
                        We store a masked document number for display and a one-way hash of the full
                        number to detect duplicates. We keep KYC records only as long as needed for
                        verification, compliance, and dispute handling.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_2">
                  <div className="section-title">
                    <h2>3. How we use your information</h2>
                    <p>We use your information to:</p>
                  </div>

                  <div className="privacy-policy-entry-item-content-box">
                    <ul>
                      <li>Process and deliver your orders</li>
                      <li>Communicate with you regarding purchases and account activity</li>
                      <li>Improve our website and services</li>
                      <li>Send promotional emails (only if you opt in)</li>
                      <li>Prevent fraud and enhance security</li>
                      <li>Verify seller identity and moderate the marketplace</li>
                    </ul>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_3">
                  <div className="section-title">
                    <h2>4. Cookies and tracking technologies</h2>
                    <p>We use cookies to:</p>
                  </div>

                  <div className="privacy-policy-entry-item-content-box">
                    <ul>
                      <li>Enhance user experience</li>
                      <li>Remember your preferences</li>
                      <li>Analyze website traffic</li>
                    </ul>
                    <p>You can choose to disable cookies through your browser settings.</p>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_4">
                  <div className="section-title">
                    <h2>5. Sharing your information</h2>
                    <p>
                      We do not sell or rent your personal data. We may share your information with:
                    </p>
                  </div>

                  <div className="privacy-policy-entry-item-content-box">
                    <ul>
                      <li>Payment gateways</li>
                      <li>Shipping partners</li>
                      <li>Image storage and identity-verification providers</li>
                      <li>Service providers assisting in operations</li>
                    </ul>
                    <p>All partners are obligated to keep your data secure.</p>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_5">
                  <div className="section-title">
                    <h2>6. Data security</h2>
                    <p>
                      We implement appropriate security measures to protect your personal information
                      from unauthorized access, alteration, or disclosure. Access to sensitive data
                      is limited to systems and roles that need it. We retain personal data for as
                      long as your account is active or as required by law, then delete or anonymize
                      it when it is no longer needed.
                    </p>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_6">
                  <div className="section-title">
                    <h2>7. Your rights</h2>
                    <p>You have the right to:</p>
                  </div>

                  <div className="privacy-policy-entry-item-content-box">
                    <ul>
                      <li>Access your personal data</li>
                      <li>Request correction or deletion where applicable</li>
                      <li>Update profile details in your account</li>
                      <li>Opt out of marketing communications</li>
                    </ul>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_7">
                  <div className="section-title">
                    <h2>8. Third-party links</h2>
                    <p>
                      Our website may contain links to third-party websites. We are not responsible
                      for their privacy practices.
                    </p>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_8">
                  <div className="section-title">
                    <h2>9. Changes to this policy</h2>
                    <p>
                      We may update this Privacy Policy from time to time. Changes will be posted on
                      this page with an updated effective date.
                    </p>
                  </div>
                </div>

                <div className="privacy-policy-entry-item" id="privacy_9">
                  <div className="section-title">
                    <h2>10. Contact us</h2>
                    <p>
                      If you have any questions about this Privacy Policy, please contact us through
                      the <Link to="/help">Help Center</Link> or see our{' '}
                      <Link to="/terms">Terms of Service</Link>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
