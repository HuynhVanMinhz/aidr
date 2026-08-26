import { Link } from 'react-router-dom';
import { useProfile } from '../../hooks/useProfile';

export function AccountSecurityPage() {
  const { profile } = useProfile();
  const hasPassword = profile?.hasPassword ?? true;

  return (
    <div className="account-details-content-box">
      <div className="account-details-content-item">
        <div className="checkout-bill-address-title">
          <h2>Account security</h2>
        </div>

        <p className="account-muted">
          Keep your AIDR account secure with a strong password and these best practices.
        </p>

        <ul className="account-security-tips">
          <li>Use a unique password that you do not reuse on other websites.</li>
          <li>Enable a password with at least 8 characters, mixing letters and numbers.</li>
          <li>Sign out when using a shared or public device.</li>
          <li>Never share your login credentials or one-time codes with anyone.</li>
          <li>Review your recent orders if you notice unexpected activity.</li>
        </ul>

        <div className="account-form-actions">
          <Link to="/account/change-password" className="btn-default">
            {hasPassword ? 'Change password' : 'Set password'}
          </Link>
        </div>
      </div>
    </div>
  );
}
