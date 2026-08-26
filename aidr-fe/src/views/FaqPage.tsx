import { Link } from 'react-router-dom';

const FAQ_ITEMS = [
  {
    question: 'How do I track my order?',
    answer:
      'Sign in and open Account → Orders. Select an order to view its current status, items, and shipping details.',
  },
  {
    question: 'How do I request a return?',
    answer:
      'From a completed or delivered order detail page, submit a return request with the required reason and evidence links. Track progress under Account → Returns.',
  },
  {
    question: 'How do vouchers work?',
    answer:
      'Vouchers may apply at checkout when your cart meets minimum order and eligibility rules. View available offers under Account → Vouchers.',
  },
  {
    question: 'How can I become a seller?',
    answer:
      'Submit a seller registration with your proposed shop name and supporting documents. Once approved, you will receive access to Seller Center.',
  },
  {
    question: 'How do I change my password?',
    answer:
      'Go to Account → Security and follow the link to change or set your password. Use a strong, unique password for your account.',
  },
] as const;

export function FaqPage() {
  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Frequently Asked Questions</h1>
                <nav>
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <Link to="/">Home</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      FAQ
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
              {FAQ_ITEMS.map((item) => (
                <div key={item.question} className="mb-4">
                  <h2 className="h5">{item.question}</h2>
                  <p className="mb-0">{item.answer}</p>
                </div>
              ))}

              <p className="mb-0">
                Still need help? Visit the <Link to="/help">Help Center</Link> or read our{' '}
                <Link to="/terms">Terms of service</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
