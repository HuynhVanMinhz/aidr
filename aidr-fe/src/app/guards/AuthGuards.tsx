import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { selectIsAuthenticated } from '../../store/authSlice';
import type { RootState } from '../../store';
import { resolvePostLoginPath } from '../../utils/postLoginRedirect';

type GuestRouteProps = {
  redirectTo?: string;
};

/** Guest-only routes (login, register, forgot password). */
export function GuestRoute({ redirectTo = '/' }: GuestRouteProps) {
  const auth = useAppSelector((s: RootState) => s.auth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnUrl = params.get('returnUrl');

  if (isAuthenticated) {
    return <Navigate to={resolvePostLoginPath(auth.roles, returnUrl ?? redirectTo)} replace />;
  }

  return <Outlet />;
}

type ProtectedRouteProps = {
  roles?: string[];
};

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const auth = useAppSelector((s: RootState) => s.auth);
  const location = useLocation();

  if (!auth.isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  if (roles?.length) {
    const hasRole = roles.some((role) =>
      auth.roles.some((r: string) => r.toUpperCase() === role.toUpperCase()),
    );
    if (!hasRole) {
      return <Navigate to="/403" replace />;
    }
  }

  return <Outlet />;
}
