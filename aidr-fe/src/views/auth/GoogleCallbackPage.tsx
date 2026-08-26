import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../hooks/useAuth';

const CODE_STORAGE_PREFIX = 'aidr_oauth_code:';

/** Exchange OAuth code from Keycloak/Google callback. */
export function GoogleCallbackPage() {
  const { completeGoogleLogin, getErrorMessage } = useAuth();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const oauthErrorDescription = searchParams.get('error_description');

  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(
    oauthError ? oauthErrorDescription || oauthError : null,
  );
  const [loading, setLoading] = useState(Boolean(code && !oauthError));

  useEffect(() => {
    if (oauthError || !code) {
      if (!oauthError && !code) {
        setError('Missing authorization code. Please sign in with Google again from the Login page.');
      }
      setLoading(false);
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    const codeKey = CODE_STORAGE_PREFIX + code;
    if (sessionStorage.getItem(codeKey)) {
      setError('This sign-in code has already been used. Please click "Sign in with Google" again.');
      setLoading(false);
      return;
    }
    sessionStorage.setItem(codeKey, '1');

    let cancelled = false;

    (async () => {
      try {
        await completeGoogleLogin(code);
      } catch (err) {
        sessionStorage.removeItem(codeKey);
        if (!cancelled) {
          setError(getErrorMessage(err, 'Google sign-in failed.'));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, oauthError, completeGoogleLogin, getErrorMessage]);

  return (
    <AuthLayout>
      <div className="page-login">
        <div className="container">
          <div className="login-form-content" style={{ maxWidth: 520, margin: '4rem auto', textAlign: 'center' }}>
            {loading && !error && (
              <>
                <h2>Completing Google sign-in…</h2>
                <p>Please wait a moment.</p>
              </>
            )}
            {error && (
              <>
                <div className="auth-alert auth-alert--error">{error}</div>
                <div className="login-content-form-btn login-now-btn">
                  <Link to="/login">Back to sign in</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
