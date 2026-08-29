import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../hooks/useProfile';
import { useToastMessage } from '../../hooks/useToastMessage';
import * as authApi from '../../services/authApi';

export function ChangePasswordPage() {
  const { profile, loading, changePassword, getErrorMessage } = useProfile();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [sendingSetLink, setSendingSetLink] = useState(false);
  const [setLinkError, setSetLinkError] = useState<string | null>(null);
  const [setLinkSuccess, setSetLinkSuccess] = useState<string | null>(null);

  useToastMessage(passwordError);
  useToastMessage(passwordSuccess, 'success');
  useToastMessage(setLinkError);
  useToastMessage(setLinkSuccess, 'success');

  const canSubmit =
    currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    setChangingPassword(true);

    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSendSetPasswordLink() {
    if (!profile?.email) return;

    setSetLinkError(null);
    setSetLinkSuccess(null);
    setSendingSetLink(true);

    try {
      await authApi.forgotPassword({ email: profile.email });
      setSetLinkSuccess(
        'If the email is valid, we have sent a set-password link. Please check your inbox.',
      );
    } catch (err) {
      setSetLinkError(getErrorMessage(err));
    } finally {
      setSendingSetLink(false);
    }
  }

  if (loading && !profile) {
    return (
      <div className="account-details-content-box">
        <p className="account-muted">Loading…</p>
      </div>
    );
  }

  if (profile && !profile.hasPassword) {
    return (
      <div className="account-details-content-box">
        <div className="account-details-content-item">
          <div className="checkout-bill-address-title">
            <h2>Set password</h2>
          </div>

          <p className="account-muted account-section-hint">
            This account signs in with Google and does not have an AIDR password yet.
            You cannot change your password until you set one via email.
          </p>


          <div className="checkout-login-btn account-form-actions">
            <button
              type="button"
              className="btn-default btn-accent"
              onClick={handleSendSetPasswordLink}
              disabled={sendingSetLink}
            >
              {sendingSetLink ? 'Sending…' : 'Set password via email'}
            </button>
            <Link
              className="btn-default btn-border"
              to={`/forgot-password?email=${encodeURIComponent(profile.email)}`}
            >
              Open forgot password page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-details-content-box">
      <form className="checkout-bill-address-form" onSubmit={handlePasswordSubmit} noValidate>
        <div className="account-details-content-item">
          <div className="checkout-bill-address-title">
            <h2>Change password</h2>
          </div>

          <p className="account-muted account-section-hint">
            Enter your current password and a new password (at least 8 characters, with an uppercase
            letter and a special character).
          </p>


          <div className="checkout-bill-address-form">
            <div className="row">
              <div className="form-group col-lg-12">
                <label htmlFor="currentPassword">Current password *</label>
                <input
                  id="currentPassword"
                  type="password"
                  className="form-control"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="newPassword">New password *</label>
                <input
                  id="newPassword"
                  type="password"
                  className="form-control"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <label htmlFor="confirmPassword">Confirm new password *</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-control"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="form-group col-lg-12">
                <div className="checkout-login-btn">
                  <button
                    type="submit"
                    className="btn-default btn-accent"
                    disabled={changingPassword || !canSubmit}
                  >
                    {changingPassword ? 'Changing…' : 'Change password'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
