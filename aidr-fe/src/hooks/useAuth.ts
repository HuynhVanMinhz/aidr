import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../services/authApi';
import { clearSession, selectAuth, setSession } from '../store/authSlice';
import { clearProfile } from '../store/userSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { AuthTokenPayload } from '../types/auth';
import { getApiErrorMessage } from '../utils/apiError';
import { resolvePostLoginPath } from '../utils/postLoginRedirect';

const googleRedirectUri =
  import.meta.env.VITE_AUTH_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`;

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const auth = useAppSelector(selectAuth);

  const applySession = useCallback(
    (payload: AuthTokenPayload) => {
      dispatch(setSession(payload));
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout(auth.refreshToken);
    } catch {
      // Always clear client session even if API fails
    } finally {
      dispatch(clearSession());
      dispatch(clearProfile());
    }
  }, [auth.refreshToken, dispatch]);

  const redirectAfterAuth = useCallback(
    (roles: string[], returnUrl?: string | null) => {
      navigate(resolvePostLoginPath(roles, returnUrl), { replace: true });
    },
    [navigate],
  );

  const login = useCallback(
    async (email: string, password: string, returnUrl?: string | null) => {
      const result = await authApi.login({ email, password });
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Login failed.');
      }
      applySession(result.data);
      redirectAfterAuth(result.data.user.roles, returnUrl);
      return result;
    },
    [applySession, redirectAfterAuth],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string, returnUrl?: string | null) => {
      const result = await authApi.register({ fullName, email, password });
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Registration failed.');
      }
      applySession(result.data);
      redirectAfterAuth(result.data.user.roles, returnUrl);
      return result;
    },
    [applySession, redirectAfterAuth],
  );

  const startGoogleLogin = useCallback(async () => {
    const result = await authApi.getGoogleAuthUrl(googleRedirectUri);
    if (!result.success || !result.data?.authorizationUrl) {
      throw new Error(result.message || 'Unable to get Google login URL.');
    }
    window.location.assign(result.data.authorizationUrl);
  }, []);

  const completeGoogleLogin = useCallback(
    async (code: string, returnUrl?: string | null) => {
      const result = await authApi.completeGoogleLogin(code, googleRedirectUri);
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Google login failed.');
      }
      applySession(result.data);
      redirectAfterAuth(result.data.user.roles, returnUrl);
      return result;
    },
    [applySession, redirectAfterAuth],
  );

  return {
    ...auth,
    login,
    register,
    logout,
    startGoogleLogin,
    completeGoogleLogin,
    getErrorMessage: getApiErrorMessage,
  };
}

export { googleRedirectUri };
