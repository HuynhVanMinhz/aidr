import { Link } from 'react-router-dom';
import { useProfile } from '../../hooks/useProfile';

/** Grouped so the page scans in three passes instead of one dense bullet list. */
const SECURITY_GROUPS = [
  {
    title: 'Password',
    icon: 'fa-solid fa-key',
    tips: [
      'Use a unique password that you do not reuse on other websites.',
      'Use at least 8 characters, mixing letters and numbers.',
    ],
  },
  {
    title: 'Devices & sign-in',
    icon: 'fa-solid fa-laptop',
    tips: [
      'Sign out when using a shared or public device.',
      'Never share your login credentials or one-time codes with anyone.',
    ],
  },
  {
    title: 'Account activity',
    icon: 'fa-solid fa-clock-rotate-left',
    tips: ['Review your recent orders if you notice unexpected activity.'],
  },
] as const;

export function AccountSecurityPage() {
  const { profile } = useProfile();
  const hasPassword = profile?.hasPassword ?? true;

  return (
    <div className="account-details-content-box">
      <div className="account-details-content-item">
        <div className="checkout-bill-address-title">
          <h2>Account security</h2>
        </div>

        <p className="account-muted account-section-hint">
          Keep your AIDR account secure with a strong password and these best practices.
        </p>

        <div className="account-security-groups">
          {SECURITY_GROUPS.map((group) => (
            <section key={group.title} className="account-security-group">
              <div className="account-security-group__head">
                <span className="account-security-group__icon" aria-hidden="true">
                  <i className={group.icon} />
                </span>
                <h3>{group.title}</h3>
              </div>
              <ul className="account-security-tips">
                {group.tips.map((tip) => (
                  <li key={tip}>
                    <i className="fa-solid fa-check" aria-hidden="true" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="account-form-actions">
          <Link to="/account/change-password" className="btn-default">
            {hasPassword ? 'Change password' : 'Set password'}
          </Link>
        </div>
      </div>
    </div>
  );
}
