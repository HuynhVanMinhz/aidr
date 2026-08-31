import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { openShoppingAssistant } from '../../utils/openShoppingAssistant';

export function SupportCta() {
  const { isAuthenticated } = useAuth();
  const chatTo = isAuthenticated ? '/chat' : `/login?returnUrl=${encodeURIComponent('/chat')}`;

  return (
    <div className="support-cta">
      <div className="support-cta__copy">
        <h2 className="support-cta__title">Still need help?</h2>
        <p className="support-cta__text">
          Our team and AI assistant are here for order questions, returns, and account support.
        </p>
      </div>
      <div className="support-cta__actions">
        <Link to={chatTo} className="btn-default support-cta__btn">
          Contact Support
        </Link>
        <button
          type="button"
          className="btn-default btn-border support-cta__btn"
          onClick={openShoppingAssistant}
        >
          Chat with us
        </button>
      </div>
    </div>
  );
}
